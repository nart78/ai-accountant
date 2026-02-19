"""
AI-powered document processing using Google Gemini.
This service extracts financial information from documents and categorizes them.
"""
import json
import base64
from typing import Dict, Any
from datetime import datetime
import google.generativeai as genai
from app.config import settings


class AIDocumentProcessor:
    """Process financial documents using Google Gemini AI."""

    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(settings.ai_model)

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
            if file_type in ['png', 'jpg', 'jpeg', 'pdf']:
                result = await self._process_with_vision(file_content, file_type, prompt)
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
            return {
                "success": False,
                "error": str(e),
                "data": None,
                "needs_review": True
            }

    def _create_extraction_prompt(self) -> str:
        """Create the prompt for Gemini to extract financial data."""
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

    async def _process_with_vision(
        self,
        file_content: bytes,
        file_type: str,
        prompt: str
    ) -> str:
        """Process image or PDF using Gemini's vision capabilities."""
        media_type_map = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg'
        }
        mime_type = media_type_map.get(file_type, 'image/jpeg')

        file_part = {
            "mime_type": mime_type,
            "data": file_content
        }

        response = self.model.generate_content(
            [prompt, file_part],
            generation_config=genai.types.GenerationConfig(
                temperature=settings.ai_temperature,
                max_output_tokens=settings.ai_max_tokens,
            ),
        )

        return response.text

    async def _process_text_document(
        self,
        file_content: bytes,
        prompt: str
    ) -> str:
        """Process text-based document (CSV, XLSX)."""
        text_content = file_content.decode('utf-8')

        response = self.model.generate_content(
            f"{prompt}\n\nDocument content:\n{text_content}",
            generation_config=genai.types.GenerationConfig(
                temperature=settings.ai_temperature,
                max_output_tokens=settings.ai_max_tokens,
            ),
        )

        return response.text

    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate Gemini's JSON response."""
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

        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=1000,
            ),
        )

        return self._parse_ai_response(response.text)
