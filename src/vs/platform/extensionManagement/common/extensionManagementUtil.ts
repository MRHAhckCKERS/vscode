/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareIgnoreCase } from 'vs/base/common/strings';
import { IExtensionIdentifier, IGalleryExtension, ILocalExtension, IExtensionsControlManifest } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionIdentifier, IExtension, TargetPlatform } from 'vs/platform/extensions/common/extensions';

export function areSameExtensions(a: IExtensionIdentifier, b: IExtensionIdentifier): boolean {
	if (a.uuid && b.uuid) {
		return a.uuid === b.uuid;
	}
	if (a.id === b.id) {
		return true;
	}
	return compareIgnoreCase(a.id, b.id) === 0;
}

const ExtensionKeyRegex = /^([^.]+\..+)-(\d+\.\d+\.\d+)(-(.+))?$/;

export class ExtensionKey {

	static create(extension: ILocalExtension | IGalleryExtension): ExtensionKey {
		const version = (extension as ILocalExtension).manifest ? (extension as ILocalExtension).manifest.version : (extension as IGalleryExtension).version;
		const targetPlatform = (extension as ILocalExtension).manifest ? (extension as ILocalExtension).targetPlatform : (extension as IGalleryExtension).properties.targetPlatform;
		return new ExtensionKey(extension.identifier, version, targetPlatform);
	}

	static parse(key: string): ExtensionKey | null {
		const matches = ExtensionKeyRegex.exec(key);
		return matches && matches[1] && matches[2] ? new ExtensionKey({ id: matches[1] }, matches[2], matches[4] as TargetPlatform || undefined) : null;
	}

	readonly id: string;

	constructor(
		identifier: IExtensionIdentifier,
		readonly version: string,
		readonly targetPlatform: TargetPlatform = TargetPlatform.UNDEFINED,
	) {
		this.id = identifier.id;
	}

	toString(): string {
		return `${this.id}-${this.version}${this.targetPlatform !== TargetPlatform.UNDEFINED ? `-${this.targetPlatform}` : ''}`;
	}

	equals(o: any): boolean {
		if (!(o instanceof ExtensionKey)) {
			return false;
		}
		return areSameExtensions(this, o) && this.version === o.version && this.targetPlatform === o.targetPlatform;
	}
}

export function getExtensionId(publisher: string, name: string): string {
	return `${publisher}.${name}`;
}

export function adoptToGalleryExtensionId(id: string): string {
	return id.toLocaleLowerCase();
}

export function getGalleryExtensionId(publisher: string, name: string): string {
	return adoptToGalleryExtensionId(getExtensionId(publisher, name));
}

export function groupByExtension<T>(extensions: T[], getExtensionIdentifier: (t: T) => IExtensionIdentifier): T[][] {
	const byExtension: T[][] = [];
	const findGroup = (extension: T) => {
		for (const group of byExtension) {
			if (group.some(e => areSameExtensions(getExtensionIdentifier(e), getExtensionIdentifier(extension)))) {
				return group;
			}
		}
		return null;
	};
	for (const extension of extensions) {
		const group = findGroup(extension);
		if (group) {
			group.push(extension);
		} else {
			byExtension.push([extension]);
		}
	}
	return byExtension;
}

export function getLocalExtensionTelemetryData(extension: ILocalExtension): any {
	return {
		id: extension.identifier.id,
		name: extension.manifest.name,
		galleryId: null,
		publisherId: extension.publisherId,
		publisherName: extension.manifest.publisher,
		publisherDisplayName: extension.publisherDisplayName,
		dependencies: extension.manifest.extensionDependencies && extension.manifest.extensionDependencies.length > 0
	};
}


/* __GDPR__FRAGMENT__
	"GalleryExtensionTelemetryData" : {
		"id" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"name": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"galleryId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"publisherId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"publisherName": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"publisherDisplayName": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"isPreReleaseVersion": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
		"dependencies": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
		"${include}": [
			"${GalleryExtensionTelemetryData2}"
		]
	}
*/
export function getGalleryExtensionTelemetryData(extension: IGalleryExtension): any {
	return {
		id: extension.identifier.id,
		name: extension.name,
		galleryId: extension.identifier.uuid,
		publisherId: extension.publisherId,
		publisherName: extension.publisher,
		publisherDisplayName: extension.publisherDisplayName,
		isPreReleaseVersion: extension.properties.isPreReleaseVersion,
		dependencies: !!(extension.properties.dependencies && extension.properties.dependencies.length > 0),
		...extension.telemetryData
	};
}

export const BetterMergeId = new ExtensionIdentifier('pprice.better-merge');

export function getMaliciousExtensionsSet(manifest: IExtensionsControlManifest): Set<string> {
	const result = new Set<string>();

	if (manifest.malicious) {
		for (const extension of manifest.malicious) {
			result.add(extension.id);
		}
	}

	return result;
}

export function getExtensionDependencies(installedExtensions: ReadonlyArray<IExtension>, extension: IExtension): IExtension[] {
	const dependencies: IExtension[] = [];
	const extensions = extension.manifest.extensionDependencies?.slice(0) ?? [];

	while (extensions.length) {
		const id = extensions.shift();

		if (id && dependencies.every(e => !areSameExtensions(e.identifier, { id }))) {
			const ext = installedExtensions.filter(e => areSameExtensions(e.identifier, { id }));
			if (ext.length === 1) {
				dependencies.push(ext[0]);
				extensions.push(...ext[0].manifest.extensionDependencies?.slice(0) ?? []);
			}
		}
	}

	return dependencies;
}
