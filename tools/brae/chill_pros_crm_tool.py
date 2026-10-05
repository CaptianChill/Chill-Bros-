"""
title: Chill Pros CRM
author: Chill Pros
description: Read-only access to the Chill Pros CRM — today's schedule, unassigned work, customer lookup, and unpaid invoices.
version: 0.1.0
requirements: requests
"""

# Paste this whole file into Open WebUI: Workspace -> Tools -> "+" (Create).
# Then click the gear (Valves) on the tool and fill in:
#   api_base_url: https://chill-bros.vercel.app
#   api_key:      the same value set as BRAE_API_KEY in Vercel
# Finally enable the tool on the model you use (Workspace -> Models -> edit -> Tools).

import requests
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        api_base_url: str = Field(
            default="https://chill-bros.vercel.app",
            description="Base URL of the live Chill Pros CRM.",
        )
        api_key: str = Field(
            default="",
            description="BRAE_API_KEY from Vercel. Keep this secret.",
        )
        timeout_seconds: int = Field(default=20, description="Request timeout.")

    def __init__(self):
        self.valves = self.Valves()

    def _get(self, path: str, params: dict | None = None) -> dict:
        if not self.valves.api_key:
            return {"ok": False, "error": "Chill Pros CRM tool has no api_key set in its Valves."}
        try:
            response = requests.get(
                self.valves.api_base_url.rstrip("/") + path,
                params=params or {},
                headers={"Authorization": f"Bearer {self.valves.api_key}"},
                timeout=self.valves.timeout_seconds,
            )
        except requests.RequestException as error:
            return {"ok": False, "error": f"Could not reach the CRM: {error}"}
        try:
            return response.json()
        except ValueError:
            return {"ok": False, "error": f"CRM returned HTTP {response.status_code} with no JSON."}

    def get_schedule(self, date: str = "", days: int = 1) -> dict:
        """
        Get scheduled Chill Pros jobs: time, customer, technician, status, location and scope.
        Use this for questions like "what's on the schedule today", "who's working tomorrow",
        or "what do we have this week".
        :param date: Start date as YYYY-MM-DD in Central time. Leave empty for today.
        :param days: How many days to include, 1 to 7. Use 7 for "this week".
        """
        params = {"days": max(1, min(7, int(days or 1)))}
        if date:
            params["date"] = date
        return self._get("/api/brae/today", params)

    def get_unassigned_work(self) -> dict:
        """
        List open Chill Pros jobs that have no technician assigned yet (the Unassigned Work queue).
        Use this for "what still needs a tech", "anything unassigned", or dispatch planning.
        """
        return self._get("/api/brae/unassigned")

    def find_customer(self, query: str) -> dict:
        """
        Look up a Chill Pros customer by name, phone or email and show their contact info
        and most recent jobs. Use this when the user names a customer.
        :param query: Part of the customer's name, phone number or email (at least 2 characters).
        """
        return self._get("/api/brae/customers", {"q": query})

    def get_unpaid_invoices(self) -> dict:
        """
        Get outstanding (unpaid) Chill Pros invoices, most overdue first, plus totals:
        money outstanding, overdue amount, invoices due today and money collected this month.
        Use this for "who owes us", "unpaid invoices", "how much is outstanding" or "how's cash flow".
        """
        return self._get("/api/brae/unpaid-invoices")
