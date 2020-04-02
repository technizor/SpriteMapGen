import * as path from 'path';

export type FileHash = string;


export interface DependencyDataOutput<T> {
    dependencies: Array<string>;
    data: T | null;
}

export interface FileHashFunc {
    (filePath: string): Promise<FileHash | null>;
}

export interface DependencyDataFunc<T> {
    (filePath: string): Promise<DependencyDataOutput<T>>;
}

export interface DependencyEntry<T> {
    key: string;
    value: DepNode<T>;
}

export type SerializableDepNode = FileHash | SerializableMapDepNode;

export interface SerializableMapDepNode {
    fileHash: FileHash;
    dependencies: Record<string, SerializableDepNode>;
}

export interface SerializableDependencyEntry {
    key: string;
    value: SerializableDepNode;
}

export class DepNode<T> {
    private fileHash: FileHash;
    private dependencies: Map<string, DepNode<T>>;
    private data: T | null;

    constructor(fileHash: FileHash, dependencies: Map<string, DepNode<T>>, data: T | null) {
        this.fileHash = fileHash;
        this.dependencies = dependencies;
        this.data = data;
    }
    equals(other: DepNode<T>): boolean {
        if (!other) return false;
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

export async function makeDepTree<T>(filePath: string, dependencyDataFunc: DependencyDataFunc<T>, fileHashFunc: FileHashFunc): Promise<DepNode<T>> {
    let fileHash = fileHashFunc(filePath);
    let depData = await dependencyDataFunc(filePath);
    let dirPath = path.dirname(filePath);

    let depFiles = depData.dependencies;
    let entries = await Promise.all(depFiles.map(async (fp): Promise<DependencyEntry<T>> => {
        let rfp = path.relative(dirPath, fp);
        let entry: DependencyEntry<T> = {
            key: rfp,
            value: await makeDepTree(fp, dependencyDataFunc, fileHashFunc) };
        return entry;
    }));
    let dependencies = new Map<string, DepNode<T>>();
    entries.forEach(entry => dependencies.set(entry.key, entry.value));
    let fh = (await fileHash)!;
    return new DepNode(fh, dependencies, depData.data);
}

function serializeDepTree<T>(root: DepNode<T>): SerializableDepNode {
    let dep = root.getDependencies();
    if (dep.size > 0) {
        let dependencies: Record<string, SerializableDepNode> = {};
        for (let entry of dep.entries()) {
            dependencies[entry[0]] = serializeDepTree(entry[1]);
        }

        return { fileHash: root.getFileHash(), dependencies };
    }
    return root.getFileHash();
}

export async function serializeDepTrees<T>(mapPaths: string[], dependencyDataFunc: DependencyDataFunc<T>, fileHashFunc: FileHashFunc): Promise<Record<string, SerializableDepNode>> {
    return Promise.all<SerializableDependencyEntry>(mapPaths
        .map(async (mp) => {
            let depTree = await makeDepTree(mp, dependencyDataFunc, fileHashFunc);
            let serializedDep = serializeDepTree(depTree);
            return { key: mp, value: serializedDep } as SerializableDependencyEntry;
        })).then(deArray => {
            let output: Record<string, SerializableDepNode> = {};
            deArray.forEach(de => output[de.key] = de.value);
            return output;
        });
}