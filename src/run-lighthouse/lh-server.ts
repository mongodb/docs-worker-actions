import ApiClient from '@lhci/utils/src/api-client.js';
import { ReportGenerator } from 'lighthouse/report/generator/report-generator.js';
import type { Project, Build, Run } from '@lhci/types/server.d.ts';
import type { LHResult } from '@lhci/types/lhr/lhr.d.ts';

/**
 * Lighhouse Server API tool
 *
 */
export class LHServer {
  api: null | ApiClient = null;
  project: null | Project = null;

  constructor() {
    const token = process.env.BUILD_TOKEN as string;
    const adminToken = process.env.ADMIN_TOKEN as string;
    this.api = new ApiClient({
      rootURL: process.env.ROOT_URL || 'http://localhost:9001',
    });
    this.api.setBuildToken(token);
    this.api.setAdminToken(adminToken);
    return this;
  }

  async setProject(): Promise<Project> {
    const token = process.env.BUILD_TOKEN as string;
    this.project = await (this.api as ApiClient).findProjectByToken(token);
    if (!this.project) {
      throw new Error('Could not find active project with provided token');
    }
  }

  async listBuilds(): Promise<void> {
    const builds = await (this.api as ApiClient).getBuilds(this.project.id);
    console.log(builds);
  }

  async getIsNewBranch(buildInfo: Build): Promise<boolean> {
    const builds: Build[] = await (this.api as ApiClient).getBuilds(
      this.project.id,
    );
    const existingBranch = builds.find(
      build => build.branch === buildInfo.branch,
    );
    return !existingBranch;
  }

  async deleteBuild(buildId: string): Promise<void> {
    await (this.api as ApiClient).deleteBuild(this.project.id, buildId);
    console.log(
      `Deleted CI build (${buildId}) from CI project ${this.project.name} (${this.project.id})`,
    );
  }

  async deleteAllBuilds(): Promise<void> {
    const builds = await (this.api as ApiClient).getBuilds(this.project.id);
    for (const build of builds) {
      await (this.api as ApiClient).deleteBuild(this.project.id, build.id);
      console.log(
        `Deleted CI build (${build.id}) from CI project ${this.project.name} (${this.project.id})`,
      );
    }
  }

  async createBuild(buildInfo: Build): Promise<Build> {
    const builds: Build[] = await (this.api as ApiClient).getBuilds(
      this.project.id,
    );
    const existingBuild = builds.find(build => build.hash === buildInfo.hash);
    if (existingBuild) {
      console.log('Build exists - deleting');
      await (this.api as ApiClient).deleteBuild(
        this.project.id,
        existingBuild.id,
      );
    }
    const build = await (this.api as ApiClient).createBuild({
      projectId: this.project.id,
      ...buildInfo,
    });
    console.log(
      `Saving CI build (${build.id}) to CI project ${this.project.name} (${this.project.id})`,
    );
    return build;
  }

  async createRun(build: Build, lhr: LHResult, url: string): Promise<Run> {
    const run = await (this.api as ApiClient).createRun({
      projectId: this.project.id,
      buildId: build.id,
      representative: false,
      url,
      lhr: ReportGenerator.generateReport(lhr, 'json'),
    });
    console.log(`Saving run for ${run.url} (${run.id})`);
    return run;
  }

  async sealBuild(build: Build): Promise<void> {
    console.log(`Sealing CI build (${build.id})`);
    return await this.api.sealBuild(this.project.id, build.id);
  }
}
