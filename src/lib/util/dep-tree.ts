export class DepNode<T> {
    private fileHash: string;
    private dependencies: Map<string, DepNode<T>>;
    private data: T | null;

    constructor(fileHash: string, dependencies: Map<string, DepNode<T>>, data: T | null) {
        this.fileHash = fileHash;
        this.dependencies = dependencies;
        this.data = data;
    }
    equals(other: DepNode<T>): boolean {
        if (this.fileHash !== other.fileHash) return false;

        if (this.dependencies.size !== other.dependencies.size) {
            for (let key of this.dependencies.keys()) {
                if (!other.dependencies.has(key)) return false;
                let thisDep = this.dependencies.get(key)!;
                let otherDep = other.dependencies.get(key)!;
                if (!thisDep.equals(otherDep)) return false;
            }
        }
        return true;
    }

    getFileHash() { return this.fileHash; }
    getDependencies() { return this.dependencies; }
    getData() { return this.data; }
}

export interface FileHashFunc {
    (filePath: string): Promise<string | null>;
}

export interface DependencyDataFunc<T> {
    (filePath: string): Promise<DependencyDataOutput<T>>;
}
export interface DependencyDataOutput<T> {
    dependencies: Array<string>;
    data: T | null;
}

interface DependencyEntry<T> {
    key: string;
    value: DepNode<T>;
}

export async function makeDepTree<T>(filePath: string, dependencyDataFunc: DependencyDataFunc<T>, fileHashFunc: FileHashFunc): Promise<DepNode<T>> {
    let fileHash = fileHashFunc(filePath);
    let depData = await dependencyDataFunc(filePath)
    let depFiles = depData.dependencies;
    let entries = await Promise.all(depFiles.map(async (fp): Promise<DependencyEntry<T>> => {
        let entry: DependencyEntry<T> = { key: fp, value: await makeDepTree(fp, dependencyDataFunc, fileHashFunc) };
        return entry;
    }));
    let dependencies = new Map<string, DepNode<T>>();
    entries.forEach(entry => dependencies.set(entry.key, entry.value));
    let fh = (await fileHash)!;
    return new DepNode(fh, dependencies, depData.data);
}

interface CleanDepNode {
    fileHash: string;
    dependencies?: Record<string, CleanDepNode>;
}
export function serializeDepTree<T>(root: DepNode<T>): CleanDepNode {
    let dep = root.getDependencies();
    if (dep.size > 0) {
        let dependencies: Record<string, CleanDepNode> = {};
        for (let entry of dep.entries()) {
            dependencies[entry[0]] = serializeDepTree(entry[1]);
        }
        return { fileHash: root.getFileHash(), dependencies };
    }
    return { fileHash: root.getFileHash() };
}