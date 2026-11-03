/**
 * Starter entry point for testing the build setup and source map configuration.
 * Chapter exercises will be implemented step-by-step.
 */

interface ServerConfig {
  name: string;
  version: string;
  environment: string;
}

const config: ServerConfig = {
  name: "Build Your Own Web Server from Scratch in Node.js",
  version: "1.0.0",
  environment: process.env.NODE_ENV || "development",
};

function bootstrap(cfg: ServerConfig): void {
  console.log(`[setup] ${cfg.name} (v${cfg.version}) initialized in ${cfg.environment} mode.`);
  console.log("[setup] TypeScript build and source maps are working properly.");
}

bootstrap(config);
