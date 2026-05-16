# DV AI Agent - IC Verification AI Assistant

![Node.js Version](https://img.shields.io/badge/Node.js-v16.20.2-339933?logo=node.js&style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20CentOS%207.9-blue?style=for-the-badge)
![Language](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&style=for-the-badge)

A cross-platform AI Agent specialized for the IC verification industry, integrating common tools and supporting custom scripts.

## Features

- **Cross-platform Support**: Runs on Windows 11 and CentOS 7.9
- **Built on Node.js v16.20.2 & TypeScript**: Modern development technology (**strictly compatible with Node.js v16.20.2**)
- **Multi-language Support**: Chinese and English, default Chinese
- **OpenAI Compatible API**: Supports local and cloud LLMs
- **Plan-and-Execute Architecture**: Clear workflow with planning before execution
- **Conversation Memory**: Supports multi-turn dialogue context and automatic history
- **Step Data Passing**: Supports `${step.N.field}` syntax for referencing previous step results
- **Rich Built-in Tools**:
  - File operations (TXT, JSON, CSV)
  - Excel reading and Markdown conversion
  - Word (DOCX) reading
  - CSV reading and Markdown conversion
  - API calls (GET/POST)
  - LLM content analysis
- **Custom Script Support**: Register and call external scripts like Python
- **Dual Mode Support**: Switch between Plan-and-Execute and QA modes

## Project Structure

```
dv-ai-agent/
├── src/
│   ├── config/          # Configuration Management
│   │   ├── index.ts
│   │   └── types.ts
│   ├── core/            # Core Modules
│   │   ├── agent.ts     # Plan-and-Execute Agent
│   │   ├── llm.ts       # LLM Integration
│   │   └── memory.ts    # Conversation Memory Management
│   ├── tools/           # Toolset
│   │   ├── base.ts      # Base Tool Class
│   │   ├── manager.ts   # Tool Manager
│   │   ├── file.ts      # File Operation Tools
│   │   ├── api.ts       # API Call Tools
│   │   ├── analyze.ts   # LLM Analysis Tools
│   │   ├── convert.ts   # Excel/CSV to Markdown
│   │   ├── script.ts    # Custom Script Tools
│   │   └── index.ts
│   ├── i18n/            # Internationalization
│   │   ├── index.ts
│   │   ├── zh.ts
│   │   └── en.ts
│   └── index.ts         # Main Entry
├── .env                 # Configuration File (Private)
├── package.json
├── tsconfig.json
└── task.md
```

## Installation & Usage

### 1. Install Dependencies
> ⚠️ **Prerequisite**: Install [Node.js v16.20.2](https://nodejs.org/download/release/v16.20.2/) first

```bash
npm install
```

### 2. Configure .env File

Pre-configured, modify as needed:

```
USER_API_KEY=your_api_key
USER_BASE_URL=https://api.deepseek.com
USER_MODEL=deepseek-v3-flash
USER_TEMPERATURE=0.3
USER_MAX_TOKENS=4096
AGENT_LANGUAGE=zh
```

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
| `!help` | Display help information |
| `!exit` | Exit program |
| `!mode` | Toggle QA/Plan mode |
| `!qa` | Switch to QA mode |
| `!plan` | Switch to Plan-and-Execute mode |
| `!clear` | Clear conversation memory |
| `!reset` | Clear memory (alias of !clear) |
| `!history` | View conversation history |
| `!mem` | View history (alias) |
| `!tools` | List all available tools |
| `!help <toolname>` | Show detailed tool information |

### Mode Description

| Mode | Description | Use Case |
|------|-------------|----------|
| Plan-and-Execute | Plan steps before execution | Complex tasks (file analysis, multi-step tasks) |
| QA Mode | Direct LLM response | Simple questions (Who am I? General knowledge) |

## Built-in Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| file_read | Read text file | filePath (required) |
| file_write | Write text file | filePath (required), content (required) |
| excel_read | Read Excel file | filePath (required), sheetName (optional) |
| excel_to_md | Convert Excel to Markdown | filePath (required), sheetName (optional), maxRows (optional) |
| docx_read | Read Word file | filePath (required) |
| csv_read | Read CSV file | filePath (required), maxRows (optional) |
| csv_to_md | Convert CSV to Markdown | filePath (required), maxRows (optional) |
| api_get | Send GET request | url (required), headers (optional) |
| api_post | Send POST request | url (required), data (optional), headers (optional) |
| analyze | Analyze content with LLM | task (required), content (required) |

## Packaging

Supports cross-platform packaging:

```bash
npm run build                                   # Build first
npm run pkg:win                                 # Package Windows version
npm run pkg:linux                               # Package Linux version
npm run pkg:all                                 # Package both platforms
```

**Output:**
- `dist/dv-ai-agent.exe` - Windows version
- `dist/dv-ai-agent` - Linux version

**Linux Execution:**
```bash
chmod +x dv-ai-agent
./dv-ai-agent
```

## Tech Stack

- **Node.js v16.20.2** (mandatory version)
- TypeScript
- XLSX (Excel Processing)
- Mammoth (DOCX Processing)
- Axios (HTTP Requests)
