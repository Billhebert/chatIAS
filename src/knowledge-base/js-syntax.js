/**
 * JavaScriptSyntaxKB - Knowledge base de sintaxe JavaScript
 *
 * Contém informações sobre:
 * - ES6+ features
 * - Sintaxe moderna
 * - Padrões comuns
 * - Boas práticas
 */

import { BaseKnowledgeBase } from '../core/base-knowledge-base.js';

export class JavaScriptSyntaxKB extends BaseKnowledgeBase {
  /**
   * Carrega documentos da knowledge base
   */
  async loadDocuments() {
    this.log('Loading JavaScript syntax documents');

    // Variables
    this.addDocument({
      id: 'variables',
      title: 'Variables: let, const, var',
      content: `
# Variables in JavaScript

## Modern Approach (ES6+)
- **const**: Use for values that won't be reassigned
- **let**: Use for values that will be reassigned
- **var**: Avoid (legacy, function-scoped)

## Best Practices
1. Prefer const by default
2. Use let only when reassignment is needed
3. Never use var in modern code

## Examples
\`\`\`javascript
const API_URL = 'https://api.example.com';
let counter = 0;
counter++; // OK with let

// const values cannot be reassigned
const config = { debug: true };
config.debug = false; // OK - mutating object
config = {}; // Error - cannot reassign
\`\`\`
      `,
      tags: ['variables', 'es6', 'syntax'],
      priority: 'high'
    });

    // Functions
    this.addDocument({
      id: 'functions',
      title: 'Functions: Arrow Functions, Regular Functions',
      content: `
# Functions in JavaScript

## Arrow Functions (ES6+)
\`\`\`javascript
const add = (a, b) => a + b;
const square = x => x * x; // Single param, no parens needed
const log = () => console.log('Hello'); // No params
\`\`\`

## Regular Functions
\`\`\`javascript
function add(a, b) {
  return a + b;
}

// Function expression
const multiply = function(a, b) {
  return a * b;
};
\`\`\`

## Key Differences
- Arrow functions don't have their own 'this'
- Arrow functions cannot be used as constructors
- Regular functions can be hoisted

## When to Use Each
- Arrow functions: callbacks, array methods, short functions
- Regular functions: methods, constructors, when you need 'this' binding
      `,
      tags: ['functions', 'arrow-functions', 'es6'],
      priority: 'high'
    });

    // Async/Await
    this.addDocument({
      id: 'async-await',
      title: 'Async/Await: Modern Asynchronous JavaScript',
      content: `
# Async/Await

## Basic Usage
\`\`\`javascript
async function fetchData() {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  return data;
}
\`\`\`

## Error Handling
\`\`\`javascript
async function fetchDataSafe() {
  try {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}
\`\`\`

## Parallel Execution
\`\`\`javascript
// Sequential (slow)
const user = await getUser();
const posts = await getPosts();

// Parallel (fast)
const [user, posts] = await Promise.all([
  getUser(),
  getPosts()
]);
\`\`\`
      `,
      tags: ['async', 'promises', 'es8'],
      priority: 'high'
    });

    // Destructuring
    this.addDocument({
      id: 'destructuring',
      title: 'Destructuring: Objects and Arrays',
      content: `
# Destructuring

## Object Destructuring
\`\`\`javascript
const user = { name: 'John', age: 30, city: 'NYC' };

// Basic
const { name, age } = user;

// Rename variables
const { name: userName, age: userAge } = user;

// Default values
const { country = 'USA' } = user;

// Nested
const { address: { street } } = user;
\`\`\`

## Array Destructuring
\`\`\`javascript
const colors = ['red', 'green', 'blue'];

// Basic
const [first, second] = colors;

// Skip elements
const [, , third] = colors;

// Rest operator
const [primary, ...others] = colors;
\`\`\`

## Function Parameters
\`\`\`javascript
function greet({ name, age }) {
  console.log(\`Hello \${name}, you are \${age}\`);
}

greet({ name: 'John', age: 30 });
\`\`\`
      `,
      tags: ['destructuring', 'es6', 'syntax'],
      priority: 'medium'
    });

    // Modules
    this.addDocument({
      id: 'modules',
      title: 'ES Modules: Import/Export',
      content: `
# ES Modules

## Exports
\`\`\`javascript
// Named exports
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export class Calculator {}

// Default export
export default class App {}

// Export list
const a = 1, b = 2;
export { a, b };
\`\`\`

## Imports
\`\`\`javascript
// Named imports
import { PI, add } from './math.js';

// Rename imports
import { add as sum } from './math.js';

// Default import
import App from './app.js';

// Namespace import
import * as math from './math.js';

// Side effects only
import './styles.css';

// Dynamic import
const module = await import('./module.js');
\`\`\`
      `,
      tags: ['modules', 'import', 'export', 'es6'],
      priority: 'high'
    });

    // Promises
    this.addDocument({
      id: 'promises',
      title: 'Promises: Asynchronous Operations',
      content: `
# Promises

## Creating Promises
\`\`\`javascript
const promise = new Promise((resolve, reject) => {
  // Async operation
  if (success) {
    resolve(value);
  } else {
    reject(error);
  }
});
\`\`\`

## Using Promises
\`\`\`javascript
promise
  .then(value => console.log(value))
  .catch(error => console.error(error))
  .finally(() => console.log('Done'));
\`\`\`

## Promise Utilities
\`\`\`javascript
// All (waits for all)
Promise.all([p1, p2, p3])
  .then(results => console.log(results));

// Race (first to complete)
Promise.race([p1, p2, p3])
  .then(result => console.log(result));

// AllSettled (waits for all, doesn't fail)
Promise.allSettled([p1, p2, p3])
  .then(results => console.log(results));

// Any (first to succeed)
Promise.any([p1, p2, p3])
  .then(result => console.log(result));
\`\`\`
      `,
      tags: ['promises', 'async', 'es6'],
      priority: 'high'
    });

    // Classes
    this.addDocument({
      id: 'classes',
      title: 'Classes: Object-Oriented JavaScript',
      content: `
# Classes

## Basic Class
\`\`\`javascript
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    console.log(\`\${this.name} makes a sound\`);
  }
}

const dog = new Animal('Dog');
dog.speak();
\`\`\`

## Inheritance
\`\`\`javascript
class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }

  speak() {
    console.log(\`\${this.name} barks\`);
  }
}
\`\`\`

## Private Fields
\`\`\`javascript
class Counter {
  #count = 0; // Private field

  increment() {
    this.#count++;
  }

  getCount() {
    return this.#count;
  }
}
\`\`\`

## Static Methods
\`\`\`javascript
class MathUtils {
  static add(a, b) {
    return a + b;
  }
}

MathUtils.add(1, 2); // 3
\`\`\`
      `,
      tags: ['classes', 'oop', 'es6'],
      priority: 'medium'
    });

    this.log(`Loaded ${this.documents.size} JavaScript syntax documents`);
  }

  /**
   * Implementa busca customizada
   */
  async search(query) {
    // Se query é string simples, busca por keywords
    if (typeof query === 'string') {
      const keywords = this.extractKeywords(query);
      return this.searchIndex(keywords);
    }

    // Se query é objeto estruturado
    if (query.type === 'topic') {
      // Busca por tópico
      const docs = this.listDocuments({ tags: [query.value] });
      return docs.map(doc => ({ document: doc, score: 1 }));
    }

    if (query.type === 'patterns' && query.code) {
      // Análise de código para encontrar padrões relevantes
      return this.analyzeCodePatterns(query.code);
    }

    // Fallback: busca genérica
    return [];
  }

  /**
   * Analisa código e retorna documentos relevantes
   */
  analyzeCodePatterns(code) {
    const results = [];

    // Detecta padrões no código
    if (code.match(/\bconst\b|\blet\b|\bvar\b/)) {
      const doc = this.getDocument('variables');
      if (doc) results.push({ document: doc, score: 0.9 });
    }

    if (code.match(/\basync\b|\bawait\b/)) {
      const doc = this.getDocument('async-await');
      if (doc) results.push({ document: doc, score: 0.95 });
    }

    if (code.match(/=>/)) {
      const doc = this.getDocument('functions');
      if (doc) results.push({ document: doc, score: 0.8 });
    }

    if (code.match(/\bimport\b|\bexport\b/)) {
      const doc = this.getDocument('modules');
      if (doc) results.push({ document: doc, score: 0.85 });
    }

    if (code.match(/\.then\(|new Promise/)) {
      const doc = this.getDocument('promises');
      if (doc) results.push({ document: doc, score: 0.9 });
    }

    if (code.match(/\bclass\b/)) {
      const doc = this.getDocument('classes');
      if (doc) results.push({ document: doc, score: 0.85 });
    }

    // Ordena por score
    return results.sort((a, b) => b.score - a.score);
  }
}

export default JavaScriptSyntaxKB;
