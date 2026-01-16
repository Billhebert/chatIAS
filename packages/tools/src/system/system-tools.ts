/**
 * System Operations Tools
 * 
 * This module provides system-level tools with enterprise governance,
 * combining the power of OpenCode's system tools with safety constraints.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolConfig, ToolResult, ExecutionContext } from '@chatias/core';
import { z } from 'zod';

const execAsync = promisify(exec);

/**
 * Bash Tool - Execute shell commands with safety constraints
 */
export class BashTool extends BaseTool {
  constructor() {
    super({
      id: 'bash',
      name: 'Bash Executor',
      description: 'Execute shell commands with timeout and security constraints',
      category: 'system',
      enabled: true,
      version: '3.0.0',
      parameters: {
        command: {
          type: 'string',
          required: true,
          description: 'Command to execute'
        },
        timeout: {
          type: 'number',
          required: false,
          default: 30000,
          min: 1000,
          max: 300000,
          description: 'Command timeout in milliseconds'
        },
        cwd: {
          type: 'string',
          required: false,
          description: 'Working directory'
        },
        env: {
          type: 'object',
          required: false,
          description: 'Environment variables'
        },
        shell: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Execute in shell'
        }
      },
      constraints: {
        maxExecutionTime: 300000, // 5 minutes max
        noChildProcess: false, // We do use child processes
        allowedPaths: ['./', '/tmp'], // Restrict to safe paths
        blockedCommands: ['rm -rf /', 'sudo', 'su', 'passwd', 'chmod 777']
      }
    });
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { command, timeout = 30000, cwd, env = {}, shell = true } = params;

    try {
      // Security checks
      this.validateCommand(command);

      // Prepare execution environment
      const execEnv = { ...process.env, ...env };
      const execOptions = {
        timeout: timeout,
        cwd: cwd || process.cwd(),
        env: execEnv,
        shell,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      };

      const startTime = Date.now();

      // Execute command
      const { stdout, stderr } = await execAsync(command, execOptions);

      const duration = Date.now() - startTime;
      const exitCode = 0; // Would need child_process.spawn for exit code

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        duration,
        metadata: {
          command,
          timeout,
          cwd: cwd || process.cwd(),
          shell
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
        duration: error.timeout || timeout,
        metadata: {
          command,
          timeout,
          signal: error.signal
        }
      };
    }
  }

  /**
   * Validate command for security issues
   */
  private validateCommand(command: string): void {
    const lowerCommand = command.toLowerCase();
    const blockedCommands = this.config.constraints?.blockedCommands || [];

    for (const blocked of blockedCommands) {
      if (lowerCommand.includes(blocked.toLowerCase())) {
        throw new Error(`Command blocked for security reasons: ${blocked}`);
      }
    }

    // Check for suspicious patterns
    if (lowerCommand.includes('rm -rf /') || 
        lowerCommand.includes('sudo') ||
        lowerCommand.includes('su ') ||
        lowerCommand.includes('chmod 777')) {
      throw new Error('Potentially dangerous command detected');
    }
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schema = z.object({
      command: z.string().min(1, 'Command is required'),
      timeout: z.number().int().min(1000).max(300000).optional(),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
      shell: z.boolean().optional()
    });

    return await schema.parseAsync(params);
  }
}

/**
 * Process Tool - List and manage system processes
 */
export class ProcessTool extends BaseTool {
  constructor() {
    super({
      id: 'process',
      name: 'Process Manager',
      description: 'List, monitor, and manage system processes',
      category: 'system',
      enabled: true,
      version: '3.0.0',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['list', 'kill', 'info'],
          description: 'Action to perform'
        },
        pid: {
          type: 'number',
          required: false,
          description: 'Process ID (for kill/info actions)'
        },
        name: {
          type: 'string',
          required: false,
          description: 'Process name filter (for list action)'
        },
        signal: {
          type: 'string',
          required: false,
          enum: ['SIGTERM', 'SIGKILL', 'SIGINT'],
          default: 'SIGTERM',
          description: 'Signal to send (for kill action)'
        }
      },
      constraints: {
        maxExecutionTime: 10000,
        noChildProcess: false
      }
    });
  }

  protected async action_list(params: any, context?: ExecutionContext): Promise<any> {
    const { name } = params;

    try {
      // Get process list based on platform
      let command: string;
      if (process.platform === 'win32') {
        command = 'tasklist /fo csv | findstr /v "Image Name"';
      } else {
        command = 'ps aux';
      }

      const { stdout } = await execAsync(command);
      const processes = this.parseProcessList(stdout, name);

      return {
        success: true,
        processes,
        total: processes.length,
        metadata: {
          platform: process.platform,
          filtered: !!name
        }
      };

    } catch (error) {
      throw new Error(`Failed to list processes: ${error.message}`);
    }
  }

  protected async action_kill(params: any, context?: ExecutionContext): Promise<any> {
    const { pid, signal = 'SIGTERM' } = params;

    if (!pid) {
      throw new Error('PID is required for kill action');
    }

    try {
      // Check if process exists
      const { stdout } = await execAsync(`kill -0 ${pid}`).catch(() => ({ stdout: '' }));
      if (stdout.includes('No such process')) {
        throw new Error(`Process ${pid} not found`);
      }

      // Kill process
      await execAsync(`kill -${signal.split('SIG')[1]} ${pid}`);

      return {
        success: true,
        pid,
        signal,
        message: `Process ${pid} terminated with ${signal}`,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      throw new Error(`Failed to kill process ${pid}: ${error.message}`);
    }
  }

  protected async action_info(params: any, context?: ExecutionContext): Promise<any> {
    const { pid } = params;

    if (!pid) {
      throw new Error('PID is required for info action');
    }

    try {
      // Get detailed process information
      let command: string;
      if (process.platform === 'win32') {
        command = `tasklist /fi "PID eq ${pid}" /fo csv`;
      } else {
        command = `ps -p ${pid} -o pid,ppid,cmd,%cpu,%mem,etime --no-headers`;
      }

      const { stdout } = await execAsync(command);
      const processInfo = this.parseProcessInfo(stdout, pid);

      return {
        success: true,
        process: processInfo,
        metadata: {
          platform: process.platform
        }
      };

    } catch (error: any) {
      throw new Error(`Failed to get process info for ${pid}: ${error.message}`);
    }
  }

  private parseProcessList(stdout: string, nameFilter?: string): any[] {
    const processes: any[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      let process: any;
      
      if (process.platform === 'win32') {
        // Parse Windows tasklist output
        const fields = line.split('","').map(f => f.replace(/"/g, ''));
        if (fields.length >= 5) {
          process = {
            name: fields[0],
            pid: parseInt(fields[1]),
            memory: fields[4],
            cpu: 'N/A' // Tasklist doesn't provide CPU easily
          };
        }
      } else {
        // Parse Unix ps output
        const fields = line.trim().split(/\s+/);
        if (fields.length >= 11) {
          process = {
            user: fields[0],
            pid: parseInt(fields[1]),
            cpu: parseFloat(fields[2]),
            mem: parseFloat(fields[3]),
            vsz: parseInt(fields[4]),
            rss: parseInt(fields[5]),
            tty: fields[6],
            stat: fields[7],
            start: fields[8],
            time: fields[9],
            command: fields.slice(10).join(' ')
          };
        }
      }

      if (process) {
        // Apply name filter
        if (!nameFilter || process.name?.toLowerCase().includes(nameFilter.toLowerCase()) ||
                     process.command?.toLowerCase().includes(nameFilter.toLowerCase())) {
          processes.push(process);
        }
      }
    }

    return processes;
  }

  private parseProcessInfo(stdout: string, pid: number): any {
    const lines = stdout.trim().split('\n');
    if (lines.length === 0) {
      throw new Error(`Process ${pid} not found`);
    }

    const line = lines[lines.length - 1];
    
    if (process.platform === 'win32') {
      const fields = line.split('","').map(f => f.replace(/"/g, ''));
      return {
        name: fields[0],
        pid: parseInt(fields[1]),
        session: fields[2],
        memory: fields[4],
        status: fields[4] // Windows status
      };
    } else {
      const fields = line.trim().split(/\s+/);
      return {
        pid: parseInt(fields[0]),
        ppid: parseInt(fields[1]),
        command: fields.slice(2).join(' '),
        cpu: parseFloat(fields[3]),
        mem: parseFloat(fields[4]),
        elapsed: fields[5]
      };
    }
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { action } = params;

    // Call the appropriate action method
    const actionMethod = (this as any)[`action_${action}`];
    if (!actionMethod) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await actionMethod.call(this, params, context);
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schemas = {
      list: z.object({
        action: z.literal('list'),
        name: z.string().optional()
      }),
      kill: z.object({
        action: z.literal('kill'),
        pid: z.number().int().positive(),
        signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).optional()
      }),
      info: z.object({
        action: z.literal('info'),
        pid: z.number().int().positive()
      })
    };

    const schema = schemas[action as keyof typeof schemas];
    if (!schema) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await schema.parseAsync(params);
  }
}

// Export system tools
export const SystemTools = {
  bash: BashTool,
  process: ProcessTool
};

// Factory function
export function createSystemTools() {
  return {
    bash: new BashTool(),
    process: new ProcessTool()
  };
}