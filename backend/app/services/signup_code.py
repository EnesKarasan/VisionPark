"""Kayıt doğrulama kodu üretimi ve hash."""
import hashlib
import secrets


def generate_signup_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def hash_signup_code(secret_key: str, email: str, code: str) -> str:
    raw = f"{secret_key}|{email.strip().lower()}|{code}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def codes_equal(stored_hash: str, secret_key: str, email: str, code: str) -> bool:
    import hmac

    return hmac.compare_digest(stored_hash, hash_signup_code(secret_key, email, code))
