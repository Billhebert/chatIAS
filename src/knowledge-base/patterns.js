/**
 * DesignPatternsKB - Knowledge base de padrões de design
 *
 * Contém informações sobre:
 * - Padrões de criação (Creational)
 * - Padrões estruturais (Structural)
 * - Padrões comportamentais (Behavioral)
 */

import { BaseKnowledgeBase } from '../core/base-knowledge-base.js';

export class DesignPatternsKB extends BaseKnowledgeBase {
  /**
   * Carrega documentos da knowledge base
   */
  async loadDocuments() {
    this.log('Loading design patterns documents');

    // Singleton
    this.addDocument({
      id: 'singleton',
      title: 'Singleton Pattern',
      content: `
# Singleton Pattern

## Purpose
Ensures a class has only one instance and provides a global point of access to it.

## Use When
- You need exactly one instance of a class
- You need controlled access to a single object
- Examples: Database connections, loggers, configuration managers

## Implementation
\`\`\`javascript
class Singleton {
  static #instance = null;

  constructor() {
    if (Singleton.#instance) {
      return Singleton.#instance;
    }
    Singleton.#instance = this;
  }

  static getInstance() {
    if (!Singleton.#instance) {
      Singleton.#instance = new Singleton();
    }
    return Singleton.#instance;
  }
}

// Usage
const instance1 = Singleton.getInstance();
const instance2 = Singleton.getInstance();
console.log(instance1 === instance2); // true
\`\`\`
      `,
      tags: ['singleton', 'creational', 'pattern'],
      priority: 'high'
    });

    // Factory
    this.addDocument({
      id: 'factory',
      title: 'Factory Pattern',
      content: `
# Factory Pattern

## Purpose
Provides an interface for creating objects without specifying their exact classes.

## Use When
- Object creation logic is complex
- You want to decouple object creation from usage
- You need to return different types based on input

## Implementation
\`\`\`javascript
class ShapeFactory {
  static createShape(type) {
    switch(type) {
      case 'circle':
        return new Circle();
      case 'square':
        return new Square();
      case 'triangle':
        return new Triangle();
      default:
        throw new Error(\`Unknown shape type: \${type}\`);
    }
  }
}

// Usage
const circle = ShapeFactory.createShape('circle');
const square = ShapeFactory.createShape('square');
\`\`\`
      `,
      tags: ['factory', 'creational', 'pattern'],
      priority: 'high'
    });

    // Observer
    this.addDocument({
      id: 'observer',
      title: 'Observer Pattern',
      content: `
# Observer Pattern

## Purpose
Defines a one-to-many dependency between objects so that when one object changes state, all its dependents are notified.

## Use When
- An object needs to notify other objects without knowing who they are
- Event-driven systems
- Examples: Event listeners, pub/sub systems

## Implementation
\`\`\`javascript
class Subject {
  #observers = [];

  subscribe(observer) {
    this.#observers.push(observer);
  }

  unsubscribe(observer) {
    this.#observers = this.#observers.filter(obs => obs !== observer);
  }

  notify(data) {
    this.#observers.forEach(observer => observer.update(data));
  }
}

class Observer {
  update(data) {
    console.log('Received update:', data);
  }
}

// Usage
const subject = new Subject();
const observer1 = new Observer();
const observer2 = new Observer();

subject.subscribe(observer1);
subject.subscribe(observer2);
subject.notify({ message: 'Hello observers!' });
\`\`\`
      `,
      tags: ['observer', 'behavioral', 'pattern'],
      priority: 'high'
    });

    // Strategy
    this.addDocument({
      id: 'strategy',
      title: 'Strategy Pattern',
      content: `
# Strategy Pattern

## Purpose
Defines a family of algorithms, encapsulates each one, and makes them interchangeable.

## Use When
- You have multiple algorithms for a specific task
- You want to switch algorithms at runtime
- You want to avoid multiple if/else or switch statements

## Implementation
\`\`\`javascript
class PaymentStrategy {
  pay(amount) {
    throw new Error('Method must be implemented');
  }
}

class CreditCardPayment extends PaymentStrategy {
  pay(amount) {
    console.log(\`Paid \${amount} using Credit Card\`);
  }
}

class PayPalPayment extends PaymentStrategy {
  pay(amount) {
    console.log(\`Paid \${amount} using PayPal\`);
  }
}

class PaymentContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  executePayment(amount) {
    this.strategy.pay(amount);
  }
}

// Usage
const payment = new PaymentContext(new CreditCardPayment());
payment.executePayment(100);

payment.setStrategy(new PayPalPayment());
payment.executePayment(200);
\`\`\`
      `,
      tags: ['strategy', 'behavioral', 'pattern'],
      priority: 'medium'
    });

    // Module
    this.addDocument({
      id: 'module',
      title: 'Module Pattern',
      content: `
# Module Pattern

## Purpose
Encapsulates private and public members, creating a clean separation of concerns.

## Use When
- You want to create private variables/functions
- You want to organize code into logical units
- You want to avoid global scope pollution

## Implementation
\`\`\`javascript
const Calculator = (() => {
  // Private
  let result = 0;

  const log = (operation, value) => {
    console.log(\`\${operation}: \${value}\`);
  };

  // Public API
  return {
    add(value) {
      result += value;
      log('Add', value);
      return this;
    },

    subtract(value) {
      result -= value;
      log('Subtract', value);
      return this;
    },

    getResult() {
      return result;
    },

    reset() {
      result = 0;
      return this;
    }
  };
})();

// Usage
Calculator
  .add(10)
  .subtract(3)
  .add(5);

console.log(Calculator.getResult()); // 12
\`\`\`
      `,
      tags: ['module', 'structural', 'pattern'],
      priority: 'medium'
    });

    this.log(`Loaded ${this.documents.size} design pattern documents`);
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
      const docs = this.listDocuments({ tags: [query.value] });
      return docs.map(doc => ({ document: doc, score: 1 }));
    }

    // Se busca por categoria
    if (query.type === 'category') {
      const category = query.value.toLowerCase();
      const docs = this.listDocuments({ tags: [category] });
      return docs.map(doc => ({ document: doc, score: 1 }));
    }

    // Fallback: busca genérica
    return [];
  }
}

export default DesignPatternsKB;
