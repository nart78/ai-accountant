"""
AI-powered document processing using Ollama (Llama 3.2 Vision).
This service extracts financial information from documents and categorizes them.
"""
import json
import base64
import io
import logging
from typing import Dict, Any
import httpx
from pdf2image import convert_from_bytes
from app.config import settings

logger = logging.getLogger(__name__)


class AIDocumentProcessor:
    """Process financial documents using Ollama + Llama 3.2 Vision."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ai_model

        # Canadian expense categories for business
        self.expense_categories = [
            "office_supplies",
            "rent",
            "utilities",
            "meals_and_entertainment",
            "travel",
            "vehicle_expenses",
            "professional_fees",
            "insurance",
            "bank_fees",
            "advertising",
            "software_subscriptions",
            "equipment",
            "repairs_and_maintenance",
            "employee_wages",
            "contractor_payments",
            "inventory",
            "shipping",
            "taxes_and_licenses",
            "other"
        ]

        # Document types
        self.document_types = [
            "receipt",
            "invoice",
            "bank_statement",
            "credit_card_statement",
            "payroll_record",
            "tax_document",
            "contract",
            "other"
        ]

    async def process_document(
        self,
        file_content: bytes,
        file_type: str,
        filename: str
    ) -> Dict[str, Any]:
        """
        Process a financial document and extract structured data.
        """
        prompt = self._create_extraction_prompt()

        try:
            if file_type in ['png', 'jpg', 'jpeg']:
                result = await self._process_with_vision(file_content, file_type, prompt)
            elif file_type == 'pdf':
                result = await self._process_pdf_with_vision(file_content, prompt)
            else:
                result = await self._process_text_document(file_content, prompt)

            extracted_data = self._parse_ai_response(result)

            return {
                "success": True,
                "data": extracted_data,
                "confidence": extracted_data.get("confidence", 0.0),
                "needs_review": extracted_data.get("confidence", 0.0) < 0.85
            }

        except Exception as e:
            logger.error("AI processing error: %s", e)
            return {
                "success": False,
                "error": str(e),
                "data": None,
                "needs_review": True
            }

    async def _call_ollama(self, messages: list, timeout: float = 600.0) -> str:
        """Make a chat request to the Ollama API."""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": settings.ai_temperature,
                "num_predict": settings.ai_max_tokens,
            }
        }

        response = httpx.post(
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=httpx.Timeout(timeout)
        )
        response.raise_for_status()
        return response.json()["message"]["content"]

    async def _process_with_vision(
        self,
        file_content: bytes,
        file_type: str,
        prompt: str
    ) -> str:
        """Process image using Ollama vision capabilities."""
        image_b64 = base64.b64encode(file_content).decode("utf-8")

        messages = [
            {
                "role": "user",
                "content": prompt,
                "images": [image_b64]
            }
        ]

        return await self._call_ollama(messages)

    async def _process_pdf_with_vision(
        self,
        file_content: bytes,
        prompt: str
    ) -> str:
        """Process PDF by converting pages to images for vision model."""
        images = convert_from_bytes(file_content, dpi=200)
        # Limit to first 3 pages to keep inference time reasonable on CPU
        images = images[:3]

        if len(images) == 1:
            # Single page — process directly
            buf = io.BytesIO()
            images[0].save(buf, format="PNG")
            image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            messages = [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [image_b64]
                }
            ]
            return await self._call_ollama(messages)

        # Multi-page — process each page, then consolidate
        page_results = []
        for i, page_image in enumerate(images):
            buf = io.BytesIO()
            page_image.save(buf, format="PNG")
            image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            page_prompt = f"[Page {i+1} of {len(images)}]\n\n{prompt}"

            messages = [
                {
                    "role": "user",
                    "content": page_prompt,
                    "images": [image_b64]
                }
            ]
            result = await self._call_ollama(messages)
            page_results.append(result)

        # Consolidate multi-page results
        combined = "\n\n---\n\n".join(
            f"Page {i+1} extraction:\n{r}" for i, r in enumerate(page_results)
        )
        merge_prompt = (
            "Below are AI extractions from each page of a multi-page document. "
            "Merge them into a single JSON result following the same schema. "
            "Use the most complete and confident values. Return ONLY valid JSON.\n\n"
            + combined
        )

        messages = [{"role": "user", "content": merge_prompt}]
        return await self._call_ollama(messages)

    async def _process_text_document(
        self,
        file_content: bytes,
        prompt: str
    ) -> str:
        """Process text-based document (CSV, XLSX)."""
        text_content = file_content.decode('utf-8')

        messages = [
            {
                "role": "user",
                "content": f"{prompt}\n\nDocument content:\n{text_content}"
            }
        ]

        return await self._call_ollama(messages)

    def _create_extraction_prompt(self) -> str:
        """Create the prompt for the model to extract financial data."""
        return f"""You are an expert Canadian accountant analyzing a financial document.
Extract all relevant financial information and return it as structured JSON.

For this document, identify and extract:

1. **Document Type**: One of {', '.join(self.document_types)}
2. **Transaction Details**:
   - Date of transaction (YYYY-MM-DD format)
   - Total amount (numeric only)
   - Currency (default CAD)
   - Description/memo

3. **Vendor/Customer Information**:
   - Name of vendor or customer
   - Type (vendor, customer, employee)

4. **Expense Categorization**:
   - Primary category (one of: {', '.join(self.expense_categories)})
   - Is this a business expense? (true/false)
   - Is this tax deductible in Canada? (true/false)

5. **Tax Information**:
   - GST/HST amount (if shown)
   - Tax rate applied (if shown)
   - Tax type (GST, HST, PST, or none)

6. **Line Items** (if applicable):
   - Each item with description, quantity, unit price, total

7. **Payment Information**:
   - Payment method (if shown): cash, credit_card, debit, bank_transfer, etc.
   - Payment status: paid, pending, due

8. **Confidence Score**:
   - Your confidence in the extraction (0.0 to 1.0)
   - Reasons for low confidence if any

**Important Canadian Tax Rules to Consider**:
- GST rate is 5% (federal)
- HST rates: ON=13%, NS/NB/NL/PE=15%, BC=12%
- Some expenses have 50% deduction limits (meals & entertainment)
- Certain expenses are fully deductible (office supplies, utilities)

Return ONLY valid JSON in this exact format:
{{
    "document_type": "receipt|invoice|etc",
    "transaction_date": "YYYY-MM-DD",
    "amount": 0.00,
    "currency": "CAD",
    "description": "Brief description",
    "vendor_name": "Vendor name",
    "vendor_type": "vendor|customer|employee",
    "category": "category_name",
    "subcategory": "more specific if applicable",
    "tax_amount": 0.00,
    "tax_rate": 0.05,
    "tax_type": "GST|HST|PST|none",
    "tax_deductible": true,
    "deduction_percentage": 100,
    "payment_method": "credit_card|cash|etc",
    "payment_status": "paid|pending|due",
    "line_items": [
        {{"description": "item", "quantity": 1, "unit_price": 0.00, "total": 0.00}}
    ],
    "confidence": 0.95,
    "notes": "Any important notes or reasons for low confidence"
}}

If you cannot determine a value, use null. Ensure all amounts are numeric (not strings).
"""

    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate the model's JSON response."""
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            json_str = response[json_start:json_end]

            data = json.loads(json_str)

            if 'amount' in data and data['amount']:
                data['amount'] = float(data['amount'])
            if 'tax_amount' in data and data['tax_amount']:
                data['tax_amount'] = float(data['tax_amount'])
            if 'confidence' not in data:
                data['confidence'] = 0.8

            return data

        except json.JSONDecodeError:
            return {
                "error": "Failed to parse AI response",
                "raw_response": response,
                "confidence": 0.0
            }

    async def categorize_transaction(
        self,
        description: str,
        amount: float,
        vendor: str
    ) -> Dict[str, str]:
        """Categorize a transaction based on description, amount, and vendor."""
        prompt = f"""As a Canadian accountant, categorize this business transaction:

Vendor: {vendor}
Amount: ${amount}
Description: {description}

Determine:
1. Expense category (one of: {', '.join(self.expense_categories)})
2. Whether it's tax deductible in Canada
3. If it's subject to 50% deduction rule (meals & entertainment)

Return JSON only:
{{
    "category": "category_name",
    "tax_deductible": true,
    "deduction_percentage": 100,
    "reasoning": "brief explanation"
}}
"""

        messages = [{"role": "user", "content": prompt}]
        response = await self._call_ollama(messages, timeout=60.0)
        return self._parse_ai_response(response)
