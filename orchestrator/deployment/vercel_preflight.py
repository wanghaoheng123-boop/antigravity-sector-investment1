import os


def vercel_preflight() -> dict[str, bool]:
    return {
        "has_vercel_token": bool(os.getenv("VERCEL_TOKEN")),
        "has_org_id": bool(os.getenv("VERCEL_ORG_ID")),
        "has_project_id": bool(os.getenv("VERCEL_PROJECT_ID")),
    }
