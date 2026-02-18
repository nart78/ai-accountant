"""
OCR service for extracting text from images and PDFs.
Uses Tesseract for local OCR processing.
"""
import pytesseract
from PIL import Image
import io
from pdf2image import convert_from_bytes
from typing import List, Optional


class OCRService:
    """Extract text from images and PDFs using OCR."""

    def __init__(self):
        """Initialize OCR service."""
        # Note: Tesseract must be installed on the system
        # macOS: brew install tesseract
        # Ubuntu: apt-get install tesseract-ocr
        pass

    def extract_text_from_image(self, image_bytes: bytes) -> str:
        """
        Extract text from an image using Tesseract OCR.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Extracted text
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            raise Exception(f"OCR failed: {str(e)}")

    def extract_text_from_pdf(
        self,
        pdf_bytes: bytes,
        max_pages: int = 10
    ) -> str:
        """
        Extract text from PDF using OCR.
        Converts PDF pages to images first, then applies OCR.

        Args:
            pdf_bytes: Raw PDF bytes
            max_pages: Maximum number of pages to process

        Returns:
            Extracted text from all pages
        """
        try:
            # Convert PDF to images
            images = convert_from_bytes(pdf_bytes, dpi=300)

            # Limit pages
            images = images[:max_pages]

            # Extract text from each page
            text_parts = []
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image)
                if page_text.strip():
                    text_parts.append(f"--- Page {i + 1} ---\n{page_text}")

            return "\n\n".join(text_parts)

        except Exception as e:
            raise Exception(f"PDF OCR failed: {str(e)}")

    def preprocess_image(self, image_bytes: bytes) -> bytes:
        """
        Preprocess image to improve OCR accuracy.
        Applies grayscale conversion and contrast enhancement.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Processed image bytes
        """
        try:
            from PIL import ImageEnhance

            image = Image.open(io.BytesIO(image_bytes))

            # Convert to grayscale
            image = image.convert('L')

            # Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(2.0)

            # Save to bytes
            output = io.BytesIO()
            image.save(output, format='PNG')
            return output.getvalue()

        except Exception as e:
            # If preprocessing fails, return original
            return image_bytes

    def get_confidence_score(self, image_bytes: bytes) -> float:
        """
        Get OCR confidence score for an image.

        Args:
            image_bytes: Raw image bytes

        Returns:
            Confidence score (0.0 to 1.0)
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

            # Calculate average confidence
            confidences = [int(conf) for conf in data['conf'] if conf != '-1']
            if not confidences:
                return 0.0

            avg_confidence = sum(confidences) / len(confidences)
            return avg_confidence / 100.0  # Convert to 0-1 scale

        except Exception:
            return 0.0
