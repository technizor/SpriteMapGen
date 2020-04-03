import * as path from 'path';
import { ObjectValidator } from '../validator';

export type FileHash = string | null;

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
    private valid: boolean;
    private reason: string | null;

    constructor(fileHash: FileHash, dependencies: Map<string, DepNode<T>>, data: T | null, valid: boolean, reason: string | null) {
        this.fileHash = fileHash;
        this.dependencies = dependencies;
        this.data = data;
        this.valid = valid;
        this.reason = reason;
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
    isValid() { return this.valid; }
    getReason() { return this.reason; }
}

export async function makeDepTree<T>(filePath: string, validator: ObjectValidator<T>, dependencyDataFunc: DependencyDataFunc<T>, fileHashFunc: FileHashFunc): Promise<DepNode<T>> {
    let dirPath = path.dirname(filePath);
    let dependencies = new Map<string, DepNode<T>>();
    let reason = null;

    let fileHash = await fileHashFunc(filePath);
    if (fileHash === null) {
        reason = 'File not found';
        console.error(`Invalid file (${filePath}): ${reason}`);
        return new DepNode(fileHash, dependencies, null, false, `Invalid (${filePath}): ${reason}`);
    }
    let depData = await dependencyDataFunc(filePath);

    let depValid = true;
    let depReason = 'Invalid dependencies';
    let depFiles = depData.dependencies;
    let entries = await Promise.all(depFiles.map(async (fp): Promise<DependencyEntry<T>> => {
        let rfp = path.relative(dirPath, fp);
        let entry: DependencyEntry<T> = {
            key: rfp,
            value: await makeDepTree(fp, validator, dependencyDataFunc, fileHashFunc)
        };
        return entry;
    }));
    entries.forEach(entry => {
        dependencies.set(entry.key, entry.value);
        if (!entry.value.isValid()) {
            depValid = false;
        }
    });

    if (depData.data === null) {
        if (!depValid) {
            console.error(`Invalid file (${filePath}): ${depReason}`);
        }
        return new DepNode(fileHash, dependencies, null, depValid, reason);
    }

    let valRes = validator.test(depData.data);
    let valid = valRes.valid && depValid;
    reason = (valRes.reason.message && !depValid) ? `${valRes.reason.message}, ${depReason}` : valRes.reason.message || depReason;
    if (!valid) {
        console.error(`Invalid file (${filePath}): ${reason}`);
    }
    return new DepNode(fileHash, dependencies, depData.data, valid, reason);
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

export async function serializeDepTrees<T>(mapPaths: string[], validator: ObjectValidator<T>, dependencyDataFunc: DependencyDataFunc<T>, fileHashFunc: FileHashFunc): Promise<Record<string, SerializableDepNode>> {
    return Promise.all<SerializableDependencyEntry>(mapPaths
        .map(async (mp) => {
            let depTree = await makeDepTree(mp, validator, dependencyDataFunc, fileHashFunc);

            let serializedDep = serializeDepTree(depTree);
            return { key: mp, value: serializedDep } as SerializableDependencyEntry;
        })).then(deArray => {
            let output: Record<string, SerializableDepNode> = {};
            deArray.forEach(de => output[de.key] = de.value);
            return output;
        });
}