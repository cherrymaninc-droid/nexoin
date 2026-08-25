"""Seed / cleanup minimal UI test data (quote, client, vehicle)."""
import os
import sys
import requests
from dotenv import dotenv_values

API = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", json={"email": "admin@nexoin.eu", "password": "nexoin-admin-2026"}, timeout=30).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

if sys.argv[1] == "seed":
    q = requests.post(f"{API}/quotes", json={"company": "TEST_UI_Co", "name": "TEST UI", "email": "test_ui@example.com",
                                             "origin": "Antwerp", "destination": "Lyon", "cargoType": "Pallets"}, timeout=60)
    c = requests.post(f"{API}/clients", headers=H, json={"company_name": "TEST_UI_Client"}, timeout=30)
    v = requests.post(f"{API}/vehicles", headers=H, json={"make": "TEST_UI_Truck", "registration": "TEST-UI-1"}, timeout=30)
    print("quote", q.status_code, "client", c.status_code, "vehicle", v.status_code)
else:
    for path, key, val in (("quotes", "company", "TEST_UI_Co"), ("clients", "company_name", "TEST_UI_Client"), ("vehicles", "make", "TEST_UI_Truck")):
        for item in requests.get(f"{API}/{path}", headers=H, timeout=30).json():
            if str(item.get(key, "")).startswith("TEST_"):
                print(path, requests.delete(f"{API}/{path}/{item['id']}", headers=H, timeout=30).status_code)
    for u in requests.get(f"{API}/users", headers=H, timeout=30).json():
        if u["email"].startswith("test_"):
            print("user", u["email"], requests.delete(f"{API}/users/{u['id']}", headers=H, timeout=30).status_code)
