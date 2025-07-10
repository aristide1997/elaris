# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

# Get the current directory
current_dir = Path('.')

# Collect all pydantic_ai package data, binaries, and hiddenimports
datas_pai, binaries_pai, hiddenimports_pai = collect_all('pydantic_ai')

a = Analysis(
    ['main.py'],
    pathex=[str(current_dir)],
    binaries=binaries_pai,
    datas=[
        ('settings.json', '.'),
        ('api', 'api'),
        ('core', 'core'),
        ('models', 'models'),
        ('services', 'services'),
        ('tests', 'tests'),
    ] + datas_pai,
    hiddenimports=[
        'uvicorn',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'pydantic_ai',
        'asyncio',
        'websockets',
        'aiosqlite',
        'aiohttp',
        'fastapi',
        'pydantic',
        'pydantic_settings',
    ] + hiddenimports_pai,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='mcp-chatbot-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
