/**
 * DataPatternsKB - Knowledge base sobre padrões de dados
 */

import { BaseKnowledgeBase } from '../core/base-knowledge-base.js';

export class DataPatternsKB extends BaseKnowledgeBase {
  async loadDocuments() {
    this.addDocument({
      id: 'data_validation',
      title: 'Data Validation Patterns',
      content: 'Common patterns for validating and sanitizing data.',
      tags: ['data', 'validation', 'patterns'],
      priority: 'high'
    });

    this.addDocument({
      id: 'data_transformation',
      title: 'Data Transformation Patterns',
      content: 'Patterns for transforming data structures (map, filter, reduce, etc).',
      tags: ['data', 'transformation', 'patterns'],
      priority: 'medium'
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

export default DataPatternsKB;
