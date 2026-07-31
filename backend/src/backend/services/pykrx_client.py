"""Safe pykrx loader — import-time KRX login failure must not crash the app."""

from __future__ import annotations

import importlib.util
import logging
import site
import sys
from pathlib import Path
from types import ModuleType
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

logger = logging.getLogger(__name__)

_stock_module: Any = None
_import_attempted = False
_import_error: Optional[Exception] = None
_login_ok: Optional[bool] = None

_AUTH_MODULE = "pykrx.website.comm.auth"


def _patch_auth_module(auth: ModuleType) -> None:
    original_login = auth.login_krx
    original_build = auth.build_krx_session
    original_get_session = auth.get_auth_session
    build_attempted = False

    def safe_login_krx(login_id: str, login_pw: str, session=None) -> bool:
        try:
            return original_login(login_id, login_pw, session)
        except Exception as exc:
            logger.warning("KRX login failed: %s", exc)
            return False

    auth.login_krx = safe_login_krx

    def safe_build_krx_session(login_id=None, login_pw=None):
        nonlocal build_attempted
        global _login_ok

        if build_attempted and _login_ok is False:
            return None

        build_attempted = True
        try:
            result = original_build(login_id, login_pw)
        except Exception as exc:
            logger.warning("KRX session build failed: %s", exc)
            _login_ok = False
            return None

        ok = result is not None and getattr(result, "is_authenticated", False)
        _login_ok = ok
        if not ok:
            logger.info(
                "KRX login failed — pykrx disabled for this process; using yfinance/DART fallback"
            )
        return result

    auth.build_krx_session = safe_build_krx_session

    def safe_get_auth_session():
        global _login_ok
        if _login_ok is False:
            return None
        sess = original_get_session()
        if sess is not None and getattr(sess, "is_authenticated", False):
            _login_ok = True
        elif _login_ok is None and build_attempted:
            _login_ok = False
        return sess

    auth.get_auth_session = safe_get_auth_session


def _preload_patched_auth() -> None:
    if _AUTH_MODULE in sys.modules:
        return

    for site_dir in site.getsitepackages():
        auth_file = Path(site_dir) / "pykrx" / "website" / "comm" / "auth.py"
        if not auth_file.exists():
            continue

        spec = importlib.util.spec_from_file_location(_AUTH_MODULE, auth_file)
        if spec is None or spec.loader is None:
            continue

        module = importlib.util.module_from_spec(spec)
        sys.modules[_AUTH_MODULE] = module
        spec.loader.exec_module(module)
        _patch_auth_module(module)
        return


def get_pykrx_stock() -> Any:
    """Return pykrx.stock module, or raise if import is impossible."""
    global _stock_module, _import_attempted, _import_error

    if _stock_module is not None:
        return _stock_module

    if _import_attempted:
        if _import_error is not None:
            raise _import_error
        return _stock_module

    _import_attempted = True
    try:
        _preload_patched_auth()
        from pykrx import stock as stock_module

        _stock_module = stock_module
        return _stock_module
    except Exception as exc:
        _import_error = exc
        logger.warning("pykrx import failed: %s", exc)
        raise


def pykrx_available() -> bool:
    """pykrx 모듈 import 가능 여부 (KRX 로그인과 무관)."""
    try:
        get_pykrx_stock()
        return True
    except Exception:
        return False


def krx_logged_in() -> bool:
    """KRX 인증 세션 활성 여부 (프로세스당 1회만 로그인 시도)."""
    global _login_ok

    if _login_ok is not None:
        return _login_ok

    try:
        get_pykrx_stock()
        from pykrx.website.comm.auth import get_auth_session

        sess = get_auth_session()
        _login_ok = sess is not None and getattr(sess, "is_authenticated", False)
    except Exception:
        _login_ok = False

    return _login_ok


def use_pykrx() -> bool:
    """pykrx API 사용 가능 — import 성공 + KRX 로그인 완료."""
    return krx_logged_in()
