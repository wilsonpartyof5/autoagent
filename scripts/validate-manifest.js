#!/usr/bin/env node
/**
 * Manifest Validation Script
 * 
 * Validates apps/autoagent-app/manifest.json structure
 * Based on Apps SDK manifest schema requirements
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const MANIFEST_PATH = join(ROOT_DIR, 'apps', 'autoagent-app', 'manifest.json');

// Expected schema structure (based on Apps SDK patterns)
const REQUIRED_FIELDS = {
  root: ['schemaVersion', 'name', 'description', 'version', 'author'],
  author: ['name', 'email'],
  connectors: {
    required: ['type', 'url', 'tools'],
    type: 'array',
  },
  ui: {
    widgets: {
      required: ['id', 'source'],
      type: 'array',
    },
  },
  tools: {
    type: 'array',
    itemRequired: ['name', 'description', 'inputSchema'],
  },
};

function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  // Validate root-level required fields
  for (const field of REQUIRED_FIELDS.root) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate schemaVersion
  if (manifest.schemaVersion !== 'v1') {
    warnings.push(`schemaVersion is "${manifest.schemaVersion}", expected "v1"`);
  }

  // Validate author object
  if (manifest.author) {
    for (const field of REQUIRED_FIELDS.author) {
      if (!(field in manifest.author)) {
        errors.push(`Missing required field: author.${field}`);
      }
    }
  }

  // Validate connectors
  if (!Array.isArray(manifest.connectors)) {
    errors.push('connectors must be an array');
  } else {
    manifest.connectors.forEach((connector, index) => {
      for (const field of REQUIRED_FIELDS.connectors.required) {
        if (!(field in connector)) {
          errors.push(`Missing required field: connectors[${index}].${field}`);
        }
      }
      if (connector.type !== 'mcp') {
        warnings.push(`connectors[${index}].type is "${connector.type}", expected "mcp"`);
      }
      if (connector.tools && !Array.isArray(connector.tools)) {
        errors.push(`connectors[${index}].tools must be an array`);
      }
    });
  }

  // Validate UI widgets
  if (manifest.ui) {
    if (!Array.isArray(manifest.ui.widgets)) {
      errors.push('ui.widgets must be an array');
    } else {
      manifest.ui.widgets.forEach((widget, index) => {
        for (const field of REQUIRED_FIELDS.ui.widgets.required) {
          if (!(field in widget)) {
            errors.push(`Missing required field: ui.widgets[${index}].${field}`);
          }
        }
      });
    }
  }

  // Validate tools
  if (manifest.tools) {
    if (!Array.isArray(manifest.tools)) {
      errors.push('tools must be an array');
    } else {
      manifest.tools.forEach((tool, index) => {
        for (const field of REQUIRED_FIELDS.tools.itemRequired) {
          if (!(field in tool)) {
            errors.push(`Missing required field: tools[${index}].${field}`);
          }
        }

        // Validate inputSchema structure
        if (tool.inputSchema) {
          if (tool.inputSchema.type !== 'object') {
            warnings.push(`tools[${index}].inputSchema.type should be "object"`);
          }
          if (!tool.inputSchema.properties) {
            warnings.push(`tools[${index}].inputSchema.properties is missing`);
          }
          if (!Array.isArray(tool.inputSchema.required)) {
            warnings.push(`tools[${index}].inputSchema.required should be an array`);
          }
        }
      });
    }
  }

  // Check for unknown fields (common ones are allowed)
  const allowedFields = [
    'schemaVersion', 'name', 'description', 'version', 'author',
    'connectors', 'ui', 'tools', 'permissions', 'capabilities'
  ];
  const unknownFields = Object.keys(manifest).filter(
    key => !allowedFields.includes(key)
  );
  if (unknownFields.length > 0) {
    warnings.push(`Unknown fields found: ${unknownFields.join(', ')}`);
  }

  return { errors, warnings };
}

function main() {
  try {
    console.log('📋 Validating manifest.json...\n');
    console.log(`Path: ${MANIFEST_PATH}\n`);

    // Read and parse manifest
    const manifestContent = readFileSync(MANIFEST_PATH, 'utf-8');
    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch (parseError) {
      console.error('❌ Invalid JSON:', parseError.message);
      process.exit(1);
    }

    console.log('✅ JSON syntax is valid\n');

    // Validate structure
    const { errors, warnings } = validateManifest(manifest);

    // Report results
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Manifest validation PASSED\n');
      console.log('Summary:');
      console.log(`  - Schema Version: ${manifest.schemaVersion}`);
      console.log(`  - Name: ${manifest.name}`);
      console.log(`  - Connectors: ${manifest.connectors?.length || 0}`);
      console.log(`  - Tools: ${manifest.tools?.length || 0}`);
      console.log(`  - Widgets: ${manifest.ui?.widgets?.length || 0}`);
      process.exit(0);
    }

    if (errors.length > 0) {
      console.error('❌ Validation FAILED - Errors found:\n');
      errors.forEach(error => console.error(`  - ${error}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Warnings:\n');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
      console.log('');
    }

    if (errors.length > 0) {
      process.exit(1);
    } else {
      console.log('✅ Manifest validation PASSED (with warnings)\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

