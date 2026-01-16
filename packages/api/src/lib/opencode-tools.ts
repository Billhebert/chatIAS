const EXA_API_KEY = process.env.EXA_API_KEY;

interface SearchParams {
  query: string;
  tokensNum?: number;
  include?: string[];
}

interface WebSearchParams {
  query: string;
  numResults?: number;
  type?: string;
}

interface WebFetchParams {
  url: string;
  format?: string;
}

interface TaskParams {
  command: string;
  description: string;
  prompt?: string;
  subagent_type?: string;
}

interface SkillParams {
  name: string;
}

interface GrepParams {
  pattern: string;
  path?: string;
  include?: string;
}

interface ReadParams {
  filePath: string;
  limit?: number;
  offset?: number;
}

interface WriteParams {
  filePath: string;
  content: string;
}

interface EditParams {
  filePath: string;
  oldString: string;
  newString: string;
}

interface GlobParams {
  pattern: string;
  path?: string;
}

interface BashParams {
  command: string;
  description?: string;
  timeout?: number;
  workdir?: string;
}

interface TodoWriteParams {
  todos: Array<{ id: string; content: string; status: string }>;
}

interface QuestionParams {
  questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }> }>;
}

export async function codesearch({ query, tokensNum, include }: SearchParams) {
  if (!EXA_API_KEY) {
    return {
      tool: 'codesearch',
      error: 'EXA_API_KEY not configured',
      message: 'Configure EXA_API_KEY environment variable for code search (get key from https://exa.ai)',
      requiresKey: true
    };
  }

  if (!EXA_API_KEY.startsWith('exa-')) {
    return {
      tool: 'codesearch',
      error: 'Invalid API key format',
      message: 'EXA_API_KEY should start with "exa-". Your key format may be for a different service.',
      requiresKey: true
    };
  }

  try {
    const response = await fetch('https://api.exa.ai/code/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        numResults: 20,
        include: include || ['code', 'url', 'title', 'author']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { tool: 'codesearch', error: `API error: ${response.status}`, details: errorText };
    }

    const data = await response.json();
    return {
      tool: 'codesearch',
      query,
      results: data.results || [],
      count: data.count || 0
    };
  } catch (error: unknown) {
    return { tool: 'codesearch', error: String(error) };
  }
}

export async function websearch({ query, numResults, type }: WebSearchParams) {
  if (!EXA_API_KEY) {
    return {
      tool: 'websearch',
      error: 'EXA_API_KEY not configured',
      message: 'Configure EXA_API_KEY environment variable for web search (get key from https://exa.ai)',
      requiresKey: true
    };
  }

  if (!EXA_API_KEY.startsWith('exa-')) {
    return {
      tool: 'websearch',
      error: 'Invalid API key format',
      message: 'EXA_API_KEY should start with "exa-". Your key format may be for a different service.',
      requiresKey: true
    };
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        numResults: numResults || 8,
        type: type || 'auto'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { tool: 'websearch', error: `API error: ${response.status}`, details: errorText };
    }

    const data = await response.json();
    return {
      tool: 'websearch',
      query,
      results: data.results || [],
      count: data.count || 0
    };
  } catch (error: unknown) {
    return { tool: 'websearch', error: String(error) };
  }
}

export async function webfetch({ url, format }: WebFetchParams) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': format === 'html' ? 'text/html' : 'application/json'
      }
    });

    let content;
    if (format === 'html') {
      content = await response.text();
    } else {
      content = await response.json();
    }

    return {
      tool: 'webfetch',
      url,
      format,
      content: typeof content === 'string' 
        ? content.substring(0, 10000) 
        : content
    };
  } catch (error: unknown) {
    return { tool: 'webfetch', error: String(error) };
  }
}

export async function task({ command, description, prompt, subagent_type }: TaskParams) {
  return {
    tool: 'task',
    command,
    description,
    subagent_type: subagent_type || 'general',
    prompt,
    status: 'simulated',
    message: 'Task execution requires agent backend configuration'
  };
}

export async function skill({ name }: SkillParams) {
  return {
    tool: 'skill',
    name,
    status: 'loaded',
    description: `Skill ${name} is available`,
    parameters: []
  };
}

export async function grep({ pattern, path, include }: GrepParams) {
  return {
    tool: 'grep',
    pattern,
    path: path || '.',
    include: include || ['*.ts', '*.tsx', '*.js', '*.jsx'],
    message: 'File search requires filesystem access'
  };
}

export async function read({ filePath, limit, offset }: ReadParams) {
  return {
    tool: 'read',
    filePath,
    limit: limit || 2000,
    offset: offset || 0,
    message: 'File read requires filesystem access'
  };
}

export async function write({ filePath, content }: WriteParams) {
  return {
    tool: 'write',
    filePath,
    contentLength: content?.length || 0,
    message: 'File write requires filesystem access'
  };
}

export async function edit({ filePath, oldString, newString }: EditParams) {
  return {
    tool: 'edit',
    filePath,
    oldStringLength: oldString?.length || 0,
    newStringLength: newString?.length || 0,
    message: 'File edit requires filesystem access'
  };
}

export async function glob({ pattern, path }: GlobParams) {
  return {
    tool: 'glob',
    pattern,
    path: path || '.',
    matches: [],
    message: 'Glob requires filesystem access'
  };
}

export async function bash({ command, description, timeout, workdir }: BashParams) {
  return {
    tool: 'bash',
    command,
    description,
    timeout: timeout || 120000,
    workdir: workdir || process.cwd(),
    message: 'Bash execution requires agent backend'
  };
}

export async function todowrite({ todos }: TodoWriteParams) {
  return {
    tool: 'todowrite',
    todos,
    status: 'updated',
    count: todos?.length || 0
  };
}

export async function todoread() {
  return {
    tool: 'todoread',
    todos: [],
    message: 'Todo list is empty'
  };
}

export async function question({ questions }: QuestionParams) {
  return {
    tool: 'question',
    questions,
    status: 'ready',
    message: 'Question prompts ready'
  };
}
