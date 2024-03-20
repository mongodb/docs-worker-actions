export interface LHProject {
  id: string;
  name: string;
  externalUrl: string;
  token: string;
  baseBranch: string;
  adminToken: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LHBuild {
  id: string;
  projectId: string;
  lifecycle: 'unsealed' | 'sealed';
  hash: string;
  branch: string;
  externalBuildUrl: string;
  runAt: string;
  commitMessage?: string;
  author?: string;
  avatarUrl?: string;
  ancestorHash?: string;
  committedAt?: string;
  ancestorCommittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LHRun {
  id: string;
  projectId: string;
  buildId: string;
  representative: boolean;
  url: string;
  lhr: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LHApiClient {
  setBuildToken: (x: string) => void;
  setAdminToken: (x: string) => void;
  setProject: (x: string) => Promise<void>;
  findProjectByToken: (x: string) => Promise<LHProject>;
  getBuilds: (x: string) => Promise<LHBuild[]>;
  deleteBuild: (x: string, y: string) => Promise<void>;
  createBuild: (x: Omit<LHBuild, 'id'>) => Promise<LHBuild>;
  createRun: ({
    projectId,
    buildId,
    representative,
    url,
    lhr,
  }: {
    projectId: string;
    buildId: string;
    representative: boolean;
    url: string;
    lhr: string | string[];
  }) => Promise<LHRun>;
  sealBuild: (x: string, y: string) => Promise<void>;
}
