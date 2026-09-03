#!/usr/bin/env node

/**
 * Drevvy Markdown Summary Updater
 * 
 * This script scans the project for markdown files, analyzes new ones,
 * and updates MARKDOWN_FILES_SUMMARY.md automatically.
 * 
 * Usage:
 *   node scripts/update-markdown-summary.js          # Run once
 *   node scripts/update-markdown-summary.js --watch  # Watch for changes
 */

const fs = require('fs');
const path = require('path');

// Try to use glob, fall back to manual scanning
let glob;
try {
  glob = require('glob').glob;
} catch (e) {
  console.warn('⚠️  glob package not found. Install it with: pnpm add -D glob');
  console.warn('   Falling back to manual file scanning...');
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SUMMARY_FILE = path.join(PROJECT_ROOT, 'MARKDOWN_FILES_SUMMARY.md');
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/temp/**',
  '**/MARKDOWN_FILES_SUMMARY.md', // Don't analyze the summary itself
];

// Category mapping based on file paths
const CATEGORY_MAP = {
  'README.md': 'Root-Level Documentation',
  'CHANGELOG.md': 'Root-Level Documentation',
  'DEPLOYMENT_': 'Root-Level Documentation',
  'docs/README.md': 'Core Documentation Hub',
  'docs/overview.md': 'Core Documentation Hub',
  'docs/quickstart.md': 'Core Documentation Hub',
  'docs/CHATGPT_': 'Core Documentation Hub',
  'docs/DEALER_ID_': 'Core Documentation Hub',
  'docs/MARKETCHECK_DEALER_ID_': 'Core Documentation Hub',
  'docs/api.md': 'API Documentation',
  'docs/api/': 'API Documentation',
  'docs/deployment/': 'Deployment Documentation',
  'docs/testing/': 'Testing Documentation',
  'docs/marketcheck/': 'MarketCheck Integration',
  'docs/enrichment-': 'MarketCheck Integration',
  'docs/lead-delivery/': 'Lead Delivery Documentation',
  'docs/design/': 'Design Documentation',
  'docs/operations/': 'Operations & Support',
  'apps/dealer-dashboard/docs/': 'App-Specific Documentation',
};

/**
 * Categorize a file based on its path
 */
function categorizeFile(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  
  for (const [pattern, category] of Object.entries(CATEGORY_MAP)) {
    if (relativePath.startsWith(pattern) || relativePath.includes(pattern)) {
      return category;
    }
  }
  
  // Default categorization
  if (relativePath.startsWith('docs/')) {
    return 'Core Documentation Hub';
  }
  
  return 'Root-Level Documentation';
}

/**
 * Extract key information from a markdown file
 */
function analyzeMarkdownFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const fileName = path.basename(filePath, '.md');
    
    // Extract title (first # heading)
    const titleMatch = content.match(/^#+\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : fileName;
    
    // Extract purpose (look for "Purpose:" or similar patterns)
    const purposeMatch = content.match(/(?:Purpose|Description|Overview)[:]\s*(.+?)(?:\n|$)/i);
    const purpose = purposeMatch ? purposeMatch[1].trim() : 'Documentation file';
    
    // Extract key content sections (look for ## headings)
    const sections = [];
    const headingMatches = content.matchAll(/^##+\s+(.+)$/gm);
    for (const match of headingMatches) {
      sections.push(match[1].trim());
    }
    
    // Extract key points (look for bullet lists under "Key Content" or similar)
    const keyContentMatch = content.match(/(?:Key Content|Content|Details)[:]\s*\n((?:[-*].+\n?)+)/i);
    const keyPoints = keyContentMatch 
      ? keyContentMatch[1].split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('*')).slice(0, 10)
      : [];
    
    // Count lines
    const lineCount = content.split('\n').length;
    
    return {
      path: relativePath,
      fileName: path.basename(filePath),
      title,
      purpose,
      sections: sections.slice(0, 10), // Limit to first 10 sections
      keyPoints: keyPoints.slice(0, 8), // Limit to first 8 points
      lineCount,
      category: categorizeFile(filePath),
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return {
      path: path.relative(PROJECT_ROOT, filePath),
      fileName: path.basename(filePath),
      title: path.basename(filePath, '.md'),
      purpose: 'Error reading file',
      sections: [],
      keyPoints: [],
      lineCount: 0,
      category: categorizeFile(filePath),
    };
  }
}

/**
 * Check if a path should be ignored
 */
function shouldIgnorePath(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const pathParts = relativePath.split(path.sep);
  
  // Check for ignored directory names
  const ignoredDirs = ['node_modules', 'dist', '.next', 'temp', '.git', 'build', 'coverage', '.turbo'];
  if (pathParts.some(part => ignoredDirs.includes(part))) {
    return true;
  }
  
  // Check for ignored patterns
  const ignorePatterns = [
    /node_modules/,
    /\/dist\//,
    /\/\.next\//,
    /\/temp\//,
    /MARKDOWN_FILES_SUMMARY\.md$/,
  ];
  
  return ignorePatterns.some(pattern => pattern.test(relativePath));
}

/**
 * Find all markdown files in the project (manual recursive scan)
 */
function findAllMarkdownFilesSync(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      
      // Skip if should be ignored
      if (shouldIgnorePath(filePath)) {
        return;
      }
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          findAllMarkdownFilesSync(filePath, fileList);
        } else if (file.endsWith('.md')) {
          const relativePath = path.relative(PROJECT_ROOT, filePath);
          if (relativePath !== 'MARKDOWN_FILES_SUMMARY.md') {
            fileList.push(filePath);
          }
        }
      } catch (err) {
        // Skip files we can't access (symlinks, permissions, etc.)
      }
    });
  } catch (err) {
    // Skip directories we can't access
  }
  
  return fileList;
}

/**
 * Find all markdown files in the project
 */
async function findAllMarkdownFiles() {
  if (glob) {
    const pattern = '**/*.md';
    const files = await glob(pattern, {
      cwd: PROJECT_ROOT,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });
    return files.filter(f => !f.includes('MARKDOWN_FILES_SUMMARY.md')).sort();
  } else {
    // Fallback to manual scanning
    return findAllMarkdownFilesSync(PROJECT_ROOT).sort();
  }
}

/**
 * Extract documented files from the summary
 */
function getDocumentedFiles(summaryContent) {
  const documented = new Set();
  const filePattern = /### `([^`]+)`/g;
  let match;
  
  while ((match = filePattern.exec(summaryContent)) !== null) {
    documented.add(match[1]);
  }
  
  return documented;
}

/**
 * Generate markdown entry for a file
 */
function generateFileEntry(analysis) {
  const { path: filePath, title, purpose, sections, keyPoints, lineCount } = analysis;
  
  let entry = `### \`${filePath}\`\n`;
  entry += `**Purpose**: ${purpose}\n`;
  
  if (sections.length > 0 || keyPoints.length > 0) {
    entry += `**Key Content**:\n`;
    
    if (keyPoints.length > 0) {
      keyPoints.forEach(point => {
        const cleanPoint = point.replace(/^[-*]\s*/, '').trim();
        if (cleanPoint) {
          entry += `- ${cleanPoint}\n`;
        }
      });
    } else if (sections.length > 0) {
      sections.slice(0, 5).forEach(section => {
        entry += `- ${section}\n`;
      });
    }
  }
  
  return entry;
}

/**
 * Update the summary document
 */
function updateSummary(newFiles) {
  if (newFiles.length === 0) {
    console.log('✅ No new markdown files found. Summary is up to date.');
    return;
  }
  
  console.log(`\n📝 Found ${newFiles.length} new markdown file(s):`);
  newFiles.forEach(file => console.log(`   - ${file.relativePath || file.path || file.absolutePath}`));
  
  // Read current summary
  let summaryContent = fs.existsSync(SUMMARY_FILE)
    ? fs.readFileSync(SUMMARY_FILE, 'utf-8')
    : '';
  
  // Analyze new files
  const analyses = newFiles.map(file => analyzeMarkdownFile(file.absolutePath));
  
  // Group by category
  const byCategory = {};
  analyses.forEach(analysis => {
    if (!byCategory[analysis.category]) {
      byCategory[analysis.category] = [];
    }
    byCategory[analysis.category].push(analysis);
  });
  
  // Insert new entries into appropriate sections
  for (const [category, files] of Object.entries(byCategory)) {
    const categoryHeader = `## ${category.replace(/\s+/g, ' ')}\n\n`;
    const categorySectionRegex = new RegExp(`## ${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=## |$)`);
    
    files.forEach(analysis => {
      const entry = generateFileEntry(analysis);
      
      // Find the category section
      if (summaryContent.includes(categoryHeader)) {
        // Insert before the next category or at the end of the section
        const sectionMatch = summaryContent.match(categorySectionRegex);
        if (sectionMatch) {
          const sectionEnd = sectionMatch.index + sectionMatch[0].length;
          summaryContent = summaryContent.slice(0, sectionEnd) + '\n' + entry + '\n' + summaryContent.slice(sectionEnd);
        }
      } else {
        // Category doesn't exist, add it before the summary statistics
        const statsHeader = '## 📊 Summary Statistics';
        if (summaryContent.includes(statsHeader)) {
          const statsIndex = summaryContent.indexOf(statsHeader);
          summaryContent = summaryContent.slice(0, statsIndex) + categoryHeader + entry + '\n\n' + summaryContent.slice(statsIndex);
        } else {
          // Append at the end
          summaryContent += '\n\n' + categoryHeader + entry + '\n';
        }
      }
    });
  }
  
  // Update summary statistics
  const totalFilesMatch = summaryContent.match(/Total Markdown Files[:\*]\s*(\d+)/);
  if (totalFilesMatch) {
    const currentTotal = parseInt(totalFilesMatch[1]);
    const newTotal = currentTotal + newFiles.length;
    summaryContent = summaryContent.replace(
      /(\*\*Total Markdown Files\*\*[:\*]\s*)\d+/,
      `$1${newTotal}`
    );
    
    // Update category counts
    for (const [category, files] of Object.entries(byCategory)) {
      const categoryName = category.replace(/[📄🗂️🔌🚀🧪🚗📧🎨🔧📱]/g, '').trim();
      const countRegex = new RegExp(`(\\*\\*${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*[:\*]\\s*)(\\d+)`);
      const countMatch = summaryContent.match(countRegex);
      if (countMatch) {
        const currentCount = parseInt(countMatch[2]);
        const newCount = currentCount + files.length;
        summaryContent = summaryContent.replace(countRegex, `$1${newCount}`);
      }
    }
  }
  
  // Update last updated date
  const now = new Date().toISOString().split('T')[0];
  summaryContent = summaryContent.replace(
    /\*\*Last Updated\*\*[:\*]\s*\d{4}-\d{2}-\d{2}/,
    `**Last Updated**: ${now}`
  );
  
  // Write updated summary
  fs.writeFileSync(SUMMARY_FILE, summaryContent, 'utf-8');
  console.log(`\n✅ Updated ${SUMMARY_FILE} with ${newFiles.length} new file(s)`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch') || args.includes('-w');
  
  console.log('🔍 Scanning for markdown files...');
  
  const allFiles = await findAllMarkdownFiles();
  console.log(`   Found ${allFiles.length} total markdown file(s)`);
  
  // Read current summary to find documented files
  let documentedFiles = new Set();
  if (fs.existsSync(SUMMARY_FILE)) {
    const summaryContent = fs.readFileSync(SUMMARY_FILE, 'utf-8');
    documentedFiles = getDocumentedFiles(summaryContent);
  }
  
  // Find new files
  const newFiles = allFiles
    .map(absolutePath => {
      const relativePath = path.relative(PROJECT_ROOT, absolutePath);
      return {
        absolutePath,
        relativePath,
        path: relativePath, // Alias for easier access
      };
    })
    .filter(file => !documentedFiles.has(file.relativePath));
  
  if (newFiles.length > 0) {
    updateSummary(newFiles);
  } else {
    console.log('✅ No new markdown files found. Summary is up to date.');
  }
  
  if (watchMode) {
    console.log('\n👀 Watching for new markdown files... (Press Ctrl+C to stop)');
    // Simple polling approach (can be enhanced with chokidar if needed)
    setInterval(async () => {
      const currentFiles = await findAllMarkdownFiles();
      const currentNew = currentFiles
        .map(absolutePath => ({
          absolutePath,
          relativePath: path.relative(PROJECT_ROOT, absolutePath),
        }))
        .filter(file => !documentedFiles.has(file.relativePath));
      
      if (currentNew.length > 0) {
        updateSummary(currentNew);
        // Update documented files set
        currentNew.forEach(file => documentedFiles.add(file.relativePath));
      }
    }, 5000); // Check every 5 seconds
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { main, analyzeMarkdownFile, findAllMarkdownFiles };

