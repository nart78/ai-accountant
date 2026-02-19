"""
API endpoints for document upload and processing.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging
import os
import re
import uuid
import shutil
import magic

from app.db import get_db
from app.config import settings
from app.models.document import Document
from app.services.ai_processor import AIDocumentProcessor
from app.services.ocr import OCRService

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
ai_processor = AIDocumentProcessor()
ocr_service = OCRService()

# Allowed MIME types mapped to extensions
ALLOWED_MIMES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}

VALID_STATUSES = {"pending", "processed", "error", "review_needed"}


def _sanitize_filename(filename: str) -> str:
    """Strip path components and dangerous characters from filename."""
    # Take only the basename (prevent path traversal)
    name = os.path.basename(filename)
    # Allow only alphanumeric, dots, hyphens, underscores
    name = re.sub(r"[^\w.\-]", "_", name)
    # Prevent hidden files
    name = name.lstrip(".")
    return name or "document"


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Upload a financial document for AI processing.
    Accepts: PDF, PNG, JPG, JPEG, CSV, XLSX
    """
    # Validate file extension
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type .{file_ext} not allowed. Allowed: {', '.join(settings.allowed_extensions)}"
        )

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if file_size > settings.max_upload_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.max_upload_size / 1024 / 1024:.0f}MB"
        )

    # Read file content and validate MIME type via magic bytes
    file_content = await file.read()
    detected_mime = magic.from_buffer(file_content, mime=True)
    if detected_mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=400,
            detail="File content does not match an allowed type."
        )

    # Sanitize filename and generate unique path
    safe_name = _sanitize_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{safe_name}"
    file_path = os.path.join(settings.upload_dir, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        logger.error("Failed to save uploaded file: %s", e)
        raise HTTPException(status_code=500, detail="File upload failed.")

    # Create database record
    document = Document(
        filename=unique_filename,
        original_filename=safe_name,
        file_path=file_path,
        file_type=file_ext,
        file_size=file_size,
        processing_status="pending",
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    # Process document with AI in the background
    if background_tasks:
        background_tasks.add_task(process_document_background, document.id, file_path, file_ext, db)
    else:
        # Process immediately if no background tasks
        await process_document_ai(document.id, file_path, file_ext, db)

    return {
        "id": document.id,
        "filename": document.original_filename,
        "status": document.processing_status,
        "message": "Document uploaded successfully. Processing in background."
    }


async def process_document_ai(document_id: int, file_path: str, file_type: str, db: Session):
    """Process document with AI and update database."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        return

    try:
        # Read file
        with open(file_path, "rb") as f:
            file_content = f.read()

        # Process with AI
        result = await ai_processor.process_document(file_content, file_type, document.original_filename)

        if result["success"]:
            data = result["data"]

            # Update document with extracted data
            document.document_type = data.get("document_type")
            document.category = data.get("category")
            document.vendor_name = data.get("vendor_name")
            document.amount = data.get("amount")
            document.currency = data.get("currency", "CAD")

            # Parse transaction date
            if data.get("transaction_date"):
                try:
                    document.transaction_date = datetime.strptime(
                        data["transaction_date"], "%Y-%m-%d"
                    )
                except (ValueError, TypeError):
                    pass

            document.tax_amount = data.get("tax_amount")
            document.tax_rate = data.get("tax_rate")
            document.extracted_data = data
            document.confidence_score = result["confidence"]
            document.processing_status = "review_needed" if result["needs_review"] else "processed"
            document.processed_at = datetime.utcnow()

        else:
            document.processing_status = "error"
            document.review_notes = "Processing failed"

    except Exception as e:
        logger.error("Document processing error for id=%d: %s", document_id, e)
        document.processing_status = "error"
        document.review_notes = "Processing error"

    db.commit()


def process_document_background(document_id: int, file_path: str, file_type: str, db: Session):
    """Wrapper for background task processing."""
    import asyncio
    asyncio.run(process_document_ai(document_id, file_path, file_type, db))


@router.get("/")
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all uploaded documents with optional filtering.
    """
    query = db.query(Document)

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Document.processing_status == status)

    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(min(limit, 100)).all()

    return {
        "total": query.count(),
        "documents": [
            {
                "id": doc.id,
                "filename": doc.original_filename,
                "type": doc.document_type,
                "category": doc.category,
                "vendor": doc.vendor_name,
                "amount": doc.amount,
                "date": doc.transaction_date.isoformat() if doc.transaction_date else None,
                "status": doc.processing_status,
                "confidence": doc.confidence_score,
                "needs_review": doc.processing_status == "review_needed",
                "created_at": doc.created_at.isoformat(),
            }
            for doc in documents
        ]
    }


@router.get("/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific document."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": document.id,
        "filename": document.original_filename,
        "file_type": document.file_type,
        "file_size": document.file_size,
        "document_type": document.document_type,
        "category": document.category,
        "vendor_name": document.vendor_name,
        "amount": document.amount,
        "currency": document.currency,
        "transaction_date": document.transaction_date.isoformat() if document.transaction_date else None,
        "tax_amount": document.tax_amount,
        "tax_rate": document.tax_rate,
        "extracted_data": document.extracted_data,
        "confidence_score": document.confidence_score,
        "processing_status": document.processing_status,
        "reviewed": document.reviewed,
        "review_notes": document.review_notes,
        "created_at": document.created_at.isoformat(),
        "processed_at": document.processed_at.isoformat() if document.processed_at else None,
    }


@router.patch("/{document_id}/review")
async def review_document(
    document_id: int,
    approved: bool,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark a document as reviewed and approved/rejected."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.reviewed = True
    document.review_notes = notes
    document.processing_status = "processed" if approved else "review_needed"

    db.commit()

    return {"message": "Document reviewed successfully", "approved": approved}


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete a document and its file."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    try:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    except Exception as e:
        logger.error("Error deleting file for document %d: %s", document_id, e)

    # Delete database record
    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Reprocess a document with AI."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.processing_status = "pending"
    db.commit()

    background_tasks.add_task(
        process_document_background,
        document.id,
        document.file_path,
        document.file_type,
        db
    )

    return {"message": "Document reprocessing started"}
