import type { ConsumerUsage } from "../types.js";
import type { Ecosystem } from "./manifestParsers.js";
export declare class MultiLangUsageScanner {
    static scanPackageUsages(projectRoot: string, packageName: string, ecosystem: Ecosystem): Promise<ConsumerUsage[]>;
}
//# sourceMappingURL=usageScanner.d.ts.map