import { describe, it, expect, vi } from 'vitest';
import { AdapterClass, SimpleAdapterClass } from '../../src/adapters/classes/adapter.class';

// Concrete test adapter for testing abstract AdapterClass
interface TestApiData {
	rawId: string;
	rawName: string;
	rawValue: number;
}

interface TestInternalData {
	id: string;
	name: string;
	value: number;
}

class TestAdapter extends AdapterClass<TestApiData, TestInternalData> {
	constructor(name: string = 'test-adapter') {
		super(name);
	}

	fromApi(apiData: TestApiData): TestInternalData {
		return {
			id: apiData.rawId,
			name: apiData.rawName,
			value: apiData.rawValue
		};
	}

	toDisplayFormat(data: TestInternalData): string {
		return `${data.name} (${data.id})`;
	}
}

// Factory function to create test adapters
function createAdapter(name: string = 'test-adapter'): TestAdapter {
	return new TestAdapter(name);
}

describe('AdapterClass', () => {
	describe('Initialization', () => {
		it('should initialize with correct id format', () => {
			const adapter = createAdapter('test-adapter');

			expect(adapter.id).toBe('adapter:test-adapter');
		});

		it('should accept different name formats', () => {
			const simpleAdapter = createAdapter('simple');
			const kebabAdapter = createAdapter('kebab-case-name');
			const snakeAdapter = createAdapter('snake_case_name');
			const camelAdapter = createAdapter('camelCaseName');

			expect(simpleAdapter.id).toBe('adapter:simple');
			expect(kebabAdapter.id).toBe('adapter:kebab-case-name');
			expect(snakeAdapter.id).toBe('adapter:snake_case_name');
			expect(camelAdapter.id).toBe('adapter:camelCaseName');
		});

		it('should handle empty string name', () => {
			const adapter = createAdapter('');

			expect(adapter.id).toBe('adapter:');
		});

		it('should handle names with special characters', () => {
			const adapter = createAdapter('test@adapter#123');

			expect(adapter.id).toBe('adapter:test@adapter#123');
		});

		it('should handle names with spaces', () => {
			const adapter = createAdapter('test adapter with spaces');

			expect(adapter.id).toBe('adapter:test adapter with spaces');
		});

		it('should create unique instances', () => {
			const adapter1 = createAdapter('adapter1');
			const adapter2 = createAdapter('adapter2');

			expect(adapter1.id).not.toBe(adapter2.id);
			expect(adapter1).not.toBe(adapter2);
		});

		it('should create identical ids for same name', () => {
			const adapter1 = createAdapter('same-name');
			const adapter2 = createAdapter('same-name');

			expect(adapter1.id).toBe(adapter2.id);
		});
	});

	describe('ID property', () => {
		it('should be a string', () => {
			const adapter = createAdapter('test');

			expect(typeof adapter.id).toBe('string');
		});

		it('should be readable', () => {
			const adapter = createAdapter('test');
			const id = adapter.id;

			expect(id).toBe('adapter:test');
		});

		it('should be mutable', () => {
			const adapter = createAdapter('test');
			adapter.id = 'adapter:modified';

			expect(adapter.id).toBe('adapter:modified');
		});
	});

	describe('Multiple instances', () => {
		it('should allow creating multiple adapters', () => {
			const adapters = [
				createAdapter('adapter1'),
				createAdapter('adapter2'),
				createAdapter('adapter3')
			];

			expect(adapters).toHaveLength(3);
			expect(adapters[0].id).toBe('adapter:adapter1');
			expect(adapters[1].id).toBe('adapter:adapter2');
			expect(adapters[2].id).toBe('adapter:adapter3');
		});

		it('should maintain separate state for each instance', () => {
			const adapter1 = createAdapter('first');
			const adapter2 = createAdapter('second');

			adapter1.id = 'modified:first';

			expect(adapter1.id).toBe('modified:first');
			expect(adapter2.id).toBe('adapter:second');
		});
	});

	describe('Extensibility', () => {
		it('should be extendable', () => {
			class ExtendedAdapter extends TestAdapter {
				customProperty: string;

				constructor(name: string, customProperty: string) {
					super(name);
					this.customProperty = customProperty;
				}

				customMethod(): string {
					return `${this.id} - ${this.customProperty}`;
				}
			}

			const extended = new ExtendedAdapter('extended', 'custom');

			expect(extended.id).toBe('adapter:extended');
			expect(extended.customProperty).toBe('custom');
			expect(extended.customMethod()).toBe('adapter:extended - custom');
		});

		it('should support method overriding', () => {
			class OverriddenAdapter extends TestAdapter {
				constructor(name: string) {
					super(name);
					// Override the id with custom logic
					this.id = `custom:${name}:override`;
				}
			}

			const overridden = new OverriddenAdapter('test');

			expect(overridden.id).toBe('custom:test:override');
		});
	});

	describe('Type checking', () => {
		it('should be an instance of AdapterClass', () => {
			const adapter = createAdapter('test');

			expect(adapter).toBeInstanceOf(AdapterClass);
		});

		it('should be an instance of TestAdapter', () => {
			const adapter = createAdapter('test');

			expect(adapter).toBeInstanceOf(TestAdapter);
		});
	});

	describe('Edge cases', () => {
		it('should handle numeric string names', () => {
			const adapter = createAdapter('12345');

			expect(adapter.id).toBe('adapter:12345');
		});

		it('should handle very long names', () => {
			const longName = 'a'.repeat(1000);
			const adapter = createAdapter(longName);

			expect(adapter.id).toBe(`adapter:${longName}`);
		});

		it('should handle unicode characters', () => {
			const adapter = createAdapter('测试适配器');

			expect(adapter.id).toBe('adapter:测试适配器');
		});

		it('should handle emoji in names', () => {
			const adapter = createAdapter('adapter🚀test');

			expect(adapter.id).toBe('adapter:adapter🚀test');
		});
	});

	describe('fromApi', () => {
		it('should transform API data to internal format', () => {
			const adapter = createAdapter();
			const apiData: TestApiData = { rawId: '123', rawName: 'Test Item', rawValue: 42 };

			const result = adapter.fromApi(apiData);

			expect(result).toEqual({
				id: '123',
				name: 'Test Item',
				value: 42
			});
		});
	});

	describe('fromApiMany', () => {
		it('should transform array of API data', () => {
			const adapter = createAdapter();
			const apiData: TestApiData[] = [
				{ rawId: '1', rawName: 'Item 1', rawValue: 10 },
				{ rawId: '2', rawName: 'Item 2', rawValue: 20 },
				{ rawId: '3', rawName: 'Item 3', rawValue: 30 }
			];

			const result = adapter.fromApiMany(apiData);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({ id: '1', name: 'Item 1', value: 10 });
			expect(result[1]).toEqual({ id: '2', name: 'Item 2', value: 20 });
			expect(result[2]).toEqual({ id: '3', name: 'Item 3', value: 30 });
		});

		it('should return empty array for empty input', () => {
			const adapter = createAdapter();

			const result = adapter.fromApiMany([]);

			expect(result).toEqual([]);
		});
	});

	describe('safeFromApi', () => {
		it('should return transformed data on success', () => {
			const adapter = createAdapter();
			const apiData: TestApiData = { rawId: '123', rawName: 'Test', rawValue: 42 };

			const result = adapter.safeFromApi(apiData);

			expect(result).toEqual({ id: '123', name: 'Test', value: 42 });
		});

		it('should return null on error', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			/* eslint-disable @typescript-eslint/no-unused-vars */
			class FailingAdapter extends AdapterClass<TestApiData, TestInternalData> {
				constructor() {
					super('failing');
				}

				fromApi(_apiData: TestApiData): TestInternalData {
					throw new Error('Transform failed');
				}

				toDisplayFormat(_data: TestInternalData): string {
					return '';
				}
			}
			/* eslint-enable @typescript-eslint/no-unused-vars */

			const adapter = new FailingAdapter();
			const result = adapter.safeFromApi({ rawId: '1', rawName: 'test', rawValue: 0 });

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('safeFromApiMany', () => {
		it('should filter out failed transformations', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			class PartialFailAdapter extends AdapterClass<TestApiData, TestInternalData> {
				constructor() {
					super('partial-fail');
				}

				fromApi(apiData: TestApiData): TestInternalData {
					if (apiData.rawValue === 0) {
						throw new Error('Cannot transform zero value');
					}
					return {
						id: apiData.rawId,
						name: apiData.rawName,
						value: apiData.rawValue
					};
				}

				toDisplayFormat(data: TestInternalData): string {
					return data.name;
				}
			}

			const adapter = new PartialFailAdapter();
			const apiData: TestApiData[] = [
				{ rawId: '1', rawName: 'Item 1', rawValue: 10 },
				{ rawId: '2', rawName: 'Item 2', rawValue: 0 }, // This will fail
				{ rawId: '3', rawName: 'Item 3', rawValue: 30 }
			];

			const result = adapter.safeFromApiMany(apiData);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ id: '1', name: 'Item 1', value: 10 });
			expect(result[1]).toEqual({ id: '3', name: 'Item 3', value: 30 });

			consoleSpy.mockRestore();
		});
	});

	describe('toDisplayFormat', () => {
		it('should return formatted display string', () => {
			const adapter = createAdapter();
			const data: TestInternalData = { id: '123', name: 'My Item', value: 42 };

			const result = adapter.toDisplayFormat(data);

			expect(result).toBe('My Item (123)');
		});
	});
});

describe('SimpleAdapterClass (backward compatibility)', () => {
	it('should initialize with correct id format', () => {
		const adapter = new SimpleAdapterClass('simple-test');

		expect(adapter.id).toBe('adapter:simple-test');
	});

	it('should be mutable', () => {
		const adapter = new SimpleAdapterClass('test');
		adapter.id = 'adapter:modified';

		expect(adapter.id).toBe('adapter:modified');
	});
});
