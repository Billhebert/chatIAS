/**
 * JSONSchemaKB - Knowledge base sobre JSON Schema
 */

import { BaseKnowledgeBase } from '../core/base-knowledge-base.js';

export class JSONSchemaKB extends BaseKnowledgeBase {
  async loadDocuments() {
    this.addDocument({
      id: 'json_schema_basics',
      title: 'JSON Schema Basics',
      content: 'JSON Schema is a vocabulary that allows you to annotate and validate JSON documents.',
      tags: ['json', 'schema', 'validation'],
      priority: 'high'
    });
  }

  async search(query) {
    if (typeof query === 'string') {
      const keywords = this.extractKeywords(query);
      return this.searchIndex(keywords);
    }
    return this.listDocuments().map(doc => ({ document: doc, score: 1 }));
  }
}

export default JSONSchemaKB;
