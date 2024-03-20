import { ReportGenerator } from 'lighthouse/report/generator/report-generator';
import ApiClient from '@lhci/utils/src/api-client';
// import { LHResult } from '@lhci/types/lhr/lhr.d.ts';
import { LHBuild, LHProject, LHRun, LHApiClient } from './types/types';

/**
 * Lighhouse Server API tool
 *
 */
export class LHServer {
  api: null | LHApiClient = null;
  project: null | LHProject = null;

  constructor() {
    const token = process.env.BUILD_TOKEN as string;
    const adminToken = process.env.ADMIN_TOKEN as string;
    this.api = new ApiClient({
      rootURL: process.env.ROOT_URL || 'http://localhost:9001',
    }) as LHApiClient;
    this.api.setBuildToken(token);
    this.api.setAdminToken(adminToken);
    return this;
  }

  async setProject(): Promise<void> {
    const token = process.env.BUILD_TOKEN as string;
    this.project = await (this.api as LHApiClient).findProjectByToken(token);
    if (!this.project) {
      throw new Error('Could not find active project with provided token');
    }
  }

  async listBuilds(): Promise<void> {
    const builds: LHBuild[] = await (this.api as LHApiClient).getBuilds(
      (this.project as LHProject).id,
    );
    console.log(builds);
  }

  async getIsNewBranch(buildInfo: Partial<LHBuild>): Promise<boolean> {
    const builds: LHBuild[] = await (this.api as LHApiClient).getBuilds(
      (this.project as LHProject).id,
    );
    const existingBranch = builds.find(
      build => build.branch === buildInfo.branch,
    );
    return !existingBranch;
  }

  async deleteBuild(buildId: string): Promise<void> {
    await (this.api as LHApiClient).deleteBuild(
      (this.project as LHProject).id,
      buildId,
    );
    console.log(
      `Deleted CI build (${buildId}) from CI project ${
        (this.project as LHProject).name
      } (${(this.project as LHProject).id})`,
    );
  }

  async deleteAllBuilds(): Promise<void> {
    const builds: LHBuild[] = await (this.api as LHApiClient).getBuilds(
      (this.project as LHProject).id,
    );
    for (const build of builds) {
      await (this.api as LHApiClient).deleteBuild(
        (this.project as LHProject).id,
        build.id,
      );
      console.log(
        `Deleted CI build (${build.id}) from CI project ${
          (this.project as LHProject).name
        } (${(this.project as LHProject).id})`,
      );
    }
  }

  async createBuild(
    buildInfo: Omit<LHBuild, 'projectId' | 'id'>,
  ): Promise<LHBuild> {
    const builds: LHBuild[] = await (this.api as LHApiClient).getBuilds(
      (this.project as LHProject).id,
    );
    const existingBuild = builds.find(build => build.hash === buildInfo.hash);
    if (existingBuild) {
      console.log('Build exists - deleting');
      await (this.api as LHApiClient).deleteBuild(
        (this.project as LHProject).id,
        existingBuild.id,
      );
    }
    const build: LHBuild = await (this.api as LHApiClient).createBuild({
      ...buildInfo,
      projectId: (this.project as LHProject).id,
    });
    console.log(
      `Saving CI build (${build.id}) to CI project ${
        (this.project as LHProject).name
      } (${(this.project as LHProject).id})`,
    );
    return build;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createRun(build: LHBuild, lhr: any, url: string): Promise<LHRun> {
    const run = await (this.api as LHApiClient).createRun({
      projectId: (this.project as LHProject).id,
      buildId: build.id,
      representative: false,
      url,
      lhr: ReportGenerator.generateReport(lhr, 'json'),
    });
    console.log(`Saving run for ${run.url} (${run.id})`);
    return run;
  }

  async sealBuild(build: LHBuild): Promise<void> {
    console.log(`Sealing CI build (${build.id})`);
    return await (this.api as LHApiClient).sealBuild(
      (this.project as LHProject).id,
      build.id,
    );
  }
}
