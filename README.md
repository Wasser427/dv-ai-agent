# DV AI Agent - IC Verification AI Assistant

![Node.js Version](https://img.shields.io/badge/Node.js-v16.20.2-339933?logo=node.js&style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20CentOS%207.9-blue?style=for-the-badge)
![Language](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&style=for-the-badge)

A cross-platform AI Agent specialized for the IC verification industry, integrating common tools and supporting custom scripts.

## Features

- **Cross-platform Support**: Runs on Windows 11 and CentOS 7.9
- **Built on Node.js v16.20.2 & TypeScript**: Modern development technology (**strictly compatible with Node.js v16.20.2**)
- **Multi-language Support**: Configurable via `.env` (`AGENT_LANGUAGE=zh` or `en`), with runtime switching (`!zh` / `!eng`)
- **CJK Character Alignment**: Accurate visual-width calculation for mixed Chinese/English console output
- **OpenAI Compatible API**: Supports local and cloud LLMs
- **Plan-and-Execute Architecture**: Clear workflow with planning before execution
- **Conversation Memory**: Supports multi-turn dialogue context with view/clear commands
- **Step Data Passing**: Supports `{step.N.field}` syntax for referencing previous step results
- **Rich Built-in Tools**:
  - File operations (TXT, LOG, MD, JSON, CSV, XML, HTML)
  - Excel reading and Markdown conversion
  - Word (DOCX) reading
  - CSV reading and Markdown conversion
  - API calls (GET/POST)
  - LLM content analysis
- **Custom Script Support**: Register and call external scripts like Python
- **Dual Mode Support**: Switch between Plan-and-Execute and QA modes on the fly
- **Drag-and-Drop File Paths**: Drag files onto the terminal to auto-insert their absolute path (Windows / Linux GUI)
- **Version Command**: Check current version with `!v`
- **Hot Reload**: Reload `.env` configuration at runtime with `!reload` — API key, model, temperature, max tokens, and language all take effect immediately without restart

## Installation & Usage

### 1. Install Dependencies
> ⚠️ **Prerequisite**: Install [Node.js v16.20.2](https://nodejs.org/download/release/v16.20.2/) first

```bash
npm install
```

### 2. Configure .env File

```
USER_API_KEY=your_api_key
USER_BASE_URL=https://api.openai.com/v1
USER_MODEL=gpt-3.5-turbo
USER_TEMPERATURE=0.3
USER_MAX_TOKENS=10000
AGENT_LANGUAGE=zh
DEBUG=false
```

| Variable | Description |
|----------|-------------|
| `USER_API_KEY` | API key for your LLM provider |
| `USER_BASE_URL` | Base URL of the OpenAI-compatible API (must include `/v1`) |
| `USER_MODEL` | Model name to use |
| `USER_TEMPERATURE` | Temperature for LLM responses (0-2) |
| `USER_MAX_TOKENS` | Maximum tokens per LLM response |
| `AGENT_LANGUAGE` | Startup language: `zh` (Chinese) or `en`/`eng` (English) |
| `DEBUG` | `true` for verbose output, `false` for clean output |

All configurations can be hot-reloaded at runtime via the `!reload` command without restarting the program.

### 3. Run Project

**Development Mode:**
```bash
npm run dev
```

**Build:**
```bash
npm run build
```

**Run Built Version:**
```bash
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `!help` | Display help information (all commands and built-in tools) |
| `!exit` | Exit program |
| `!mode` | Toggle between QA and Plan mode |
| `!qa` | Switch to QA mode (direct LLM answers) |
| `!plan` | Switch to Plan-and-Execute mode |
| `!clear` | Clear conversation memory |
| `!reset` | Clear memory (alias of `!clear`) |
| `!history` | View conversation memory records |
| `!mem` | View memory (alias of `!history`) |
| `!zh` | Switch system output to Chinese and reprint startup info |
| `!eng` | Switch system output to English and reprint startup info |
| `!v` | Display current program version |
| `!reload` | Hot-reload `.env` configuration at runtime |
| `!tools` | List all available tools with descriptions |
| `!help <toolname>` | Show detailed information about a specific tool |

### Mode Description

| Mode | Description | Use Case |
|------|-------------|----------|
| Plan-and-Execute | Plan execution steps via LLM, then execute sequentially | Complex tasks: file analysis, multi-step workflows |
| QA Mode | Direct LLM response without planning | Simple questions: general knowledge, quick queries |

**Both modes share conversation memory**, ensuring seamless context across mode switches.

### Language Switching

The initial language is determined by `AGENT_LANGUAGE` in `.env`. At runtime:

| Command | Description |
|---------|-------------|
| `!zh` | Switch all system output to Chinese; reprints banner, mode info, and command list |
| `!eng` | Switch all system output to English; reprints banner, mode info, and command list |

When switching languages or modes, the startup information (banner, mode status, command hints) is reprinted in the selected language for clarity.

## Built-in Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `file_read` | Read text file (TXT, LOG, MD, JSON, CSV, XML, HTML) | `filePath` (required) |
| `file_write` | Write content to a text file | `filePath` (required), `content` (required) |
| `excel_read` | Read Excel file and convert to Markdown table | `filePath` (required), `sheetName` (optional) |
| `excel_to_md` | Convert Excel file to Markdown table format | `filePath` (required), `sheetName` (optional), `maxRows` (optional) |
| `docx_read` | Read Word (.docx) file content | `filePath` (required) |
| `csv_read` | Read CSV file and convert to Markdown table | `filePath` (required), `maxRows` (optional) |
| `csv_to_md` | Convert CSV file to Markdown table format | `filePath` (required), `maxRows` (optional) |
| `api_get` | Send HTTP GET request | `url` (required), `headers` (optional) |
| `api_post` | Send HTTP POST request | `url` (required), `data` (optional), `headers` (optional) |
| `analyze` | Analyze content using the LLM | `task` (required), `content` (required) |

## Deployment & Packaging

### Deploy with .env

The packaged executable reads `.env` from its **same directory**. Place them together:

```
D:\my_app\                     /opt/dv-agent/
├── dv-ai-agent.exe            ├── dv-ai-agent
└── .env                       └── .env
```

`.env` is never bundled into the executable — your API keys stay private.

### Cross-platform Packaging

```bash
npm run build                                   # Build first
npm run pkg:win                                 # Package Windows version
npm run pkg:linux                               # Package Linux version (static binary)
npm run pkg:all                                 # Package both platforms
```

**Output:**
- `dist/dv-ai-agent.exe` — Windows executable
- `dist/dv-ai-agent` — Linux static binary (compatible with CentOS 7.9 GLIBC 2.17)

**Linux Execution:**
```bash
chmod +x dv-ai-agent
./dv-ai-agent
```

The Linux build uses `node16-linuxstatic-x64` target, statically linking all system libraries for maximum compatibility with CentOS 7.9.

## Project Structure

```
dv-ai-agent/
├── src/
│   ├── config/          # Configuration Management
│   │   ├── index.ts     # .env parser with multi-path resolution & hot reload
│   │   └── types.ts
│   ├── core/            # Core Modules
│   │   ├── agent.ts     # Plan-and-Execute Agent with dual-mode support
│   │   ├── llm.ts       # LLM Integration (Axios-based)
│   │   └── memory.ts    # Conversation Memory Management
│   ├── tools/           # Toolset
│   │   ├── base.ts      # Abstract Base Tool Class
│   │   ├── manager.ts   # Tool Manager (Singleton)
│   │   ├── file.ts      # File Read/Write/Excel/Docx/Csv Tools
│   │   ├── api.ts       # API GET/POST Tools
│   │   ├── analyze.ts   # LLM Content Analysis Tool
│   │   ├── convert.ts   # Excel/CSV to Markdown Conversion Tools
│   │   └── index.ts
│   ├── i18n/            # Internationalization
│   │   ├── index.ts     # I18n Manager with format() support
│   │   ├── zh.ts        # Chinese translations (70+ keys)
│   │   └── en.ts        # English translations (70+ keys)
│   ├── utils/
│   │   └── help.ts      # Help/Tools display manager
│   └── index.ts         # Main Entry (interactive CLI)
├── .env                 # Configuration File (Private, not committed)
├── package.json
├── tsconfig.json
└── task.md
```

## Tech Stack

- **Node.js v16.20.2** (mandatory version)
- TypeScript 5.x
- XLSX (Excel Processing)
- Mammoth (DOCX Processing)
- Axios (HTTP + LLM API calls)

## Workflow Example

```
=================================================
         DV AI Agent - IC Verification Assistant
     https://github.com/Wasser427/dv-ai-agent
=================================================

Welcome to DV AI Agent!

*******************************************************
  Current mode: Plan-and-Execute (Complex tasks: file reading/analysis)
  Type !qa for Q&A mode
  Type !eng for English output
*******************************************************

Commands:
  !exit    Exit program
  !mode    Toggle Q&A/Plan mode
  !qa      Switch to Q&A mode
  !plan    Switch to Plan-and-Execute mode
  !clear   Clear conversation memory
  !help    Show help information
  !tools   List all available tools
  !v       Show program version
  !reload  Reload .env configuration
  !eng / !zh

Please enter your task description:

> Read D:\data\coverage_report.xlsx and analyze the coverage
```
