export declare function getDataLake(buildInfo: any): {
  isDataLake: boolean;
  dlVersion: string;
};

export declare function isEnterprise(buildInfo: any): boolean;
export declare function isAtlas(uri: string): boolean;
type IsLocalAtlasCountFn = (db: string, ns: string, query: Record<string, any>) => Promise<number>;
export declare function isLocalAtlas(countFn: IsLocalAtlasCountFn): Promise<boolean>;
export declare function isAtlasStream(uri: string): boolean;
export declare function isLocalhost(uri: string): boolean;
export declare function isDigitalOcean(uri: string): boolean;

export declare function getGenuineMongoDB(uri: string): {
  isGenuine: boolean;
  serverName: string;
};

export declare function getBuildEnv(buildInfo: any): {
  serverOs: string;
  serverArch: string;
};
