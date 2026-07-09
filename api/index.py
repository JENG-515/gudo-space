"""
Vercel serverless 進入點。
Vercel 的 @vercel/python 會使用這個模組匯出的 WSGI `app`（即 Flask app），
所有路由都交給 server.py 處理。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app  # noqa: E402,F401
