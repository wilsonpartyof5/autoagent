# Markdown Summary Updater

This script automatically scans the project for markdown files and updates `MARKDOWN_FILES_SUMMARY.md` when new files are detected.

## Installation

First, install the required dependency:

```bash
pnpm add -D glob
```

Or if you prefer npm:

```bash
npm install --save-dev glob
```

## Usage

### One-time Update

Run the script manually to update the summary with any new markdown files:

```bash
pnpm update-docs
```

Or directly:

```bash
node scripts/update-markdown-summary.js
```

### Watch Mode

Run in watch mode to automatically update the summary when new markdown files are created:

```bash
pnpm watch-docs
```

Or directly:

```bash
node scripts/update-markdown-summary.js --watch
```

Watch mode checks for new files every 5 seconds.

## How It Works

1. **Scans** the entire project for `.md` files (excluding `node_modules`, `dist`, `.next`, `temp`, and the summary file itself)

2. **Compares** found files against what's already documented in `MARKDOWN_FILES_SUMMARY.md`

3. **Analyzes** new files by:
   - Extracting the title (first heading)
   - Finding the purpose/description
   - Identifying key sections and content points
   - Categorizing based on file path

4. **Updates** the summary document by:
   - Adding new file entries to appropriate categories
   - Updating file count statistics
   - Updating the "Last Updated" date

## Categories

Files are automatically categorized based on their path:

- **Root-Level Documentation**: Files in project root (`README.md`, `CHANGELOG.md`, `DEPLOYMENT_*.md`)
- **Core Documentation Hub**: Files in `docs/` (overview, quickstart, integration guides)
- **API Documentation**: Files in `docs/api/`
- **Deployment Documentation**: Files in `docs/deployment/`
- **Testing Documentation**: Files in `docs/testing/`
- **MarketCheck Integration**: Files in `docs/marketcheck/` or enrichment docs
- **Lead Delivery Documentation**: Files in `docs/lead-delivery/`
- **Design Documentation**: Files in `docs/design/`
- **Operations & Support**: Files in `docs/operations/`
- **App-Specific Documentation**: Files in `apps/*/docs/`

## Integration with Cursor

While Cursor doesn't have built-in file watchers, you can:

1. **Run manually** after creating new markdown files:
   ```bash
   pnpm update-docs
   ```

2. **Use watch mode** in a separate terminal while working:
   ```bash
   pnpm watch-docs
   ```

3. **Set up a Git hook** (optional) to run before commits:
   ```bash
   # .git/hooks/pre-commit
   #!/bin/sh
   pnpm update-docs
   git add MARKDOWN_FILES_SUMMARY.md
   ```

4. **Use VS Code tasks** (if using VS Code):
   Create `.vscode/tasks.json`:
   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "Update Markdown Summary",
         "type": "shell",
         "command": "pnpm update-docs",
         "problemMatcher": []
       }
     ]
   }
   ```

## Troubleshooting

### "glob package not found"

Install the dependency:
```bash
pnpm add -D glob
```

### Script doesn't detect new files

- Make sure the file has a `.md` extension
- Check that the file isn't in an ignored directory (`node_modules`, `dist`, etc.)
- Verify the file path matches one of the category patterns

### Summary file gets corrupted

The script creates a backup before writing. You can restore from git:
```bash
git checkout MARKDOWN_FILES_SUMMARY.md
```

## Customization

To customize categorization, edit the `CATEGORY_MAP` object in `scripts/update-markdown-summary.js`.

To change analysis behavior, modify the `analyzeMarkdownFile()` function.

