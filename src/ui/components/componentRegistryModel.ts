import { Router, observeEvent } from 'esp-js';
import { Logger, Guard } from '../../core';
import ModelBase from '../modelBase';
import { getComponentFactoryMetadata, ComponentFactoryMetadata } from './index';
import ComponentFactoryBase from './componentFactoryBase';
import FactoryEntry from './factoryEntry';
import ComponentMetadata from './componentMetadata';

let _log = Logger.create('ComponentRegistryModel');

export default class ComponentRegistryModel extends ModelBase {
    private _componentFactoriesEntries = new Map<string, FactoryEntry>();
    public componentsMetadata: Array<ComponentMetadata>;

    constructor(modelId:string, router:Router) {
        super(modelId, router);
    }

    public getTitle() : string {
        return 'Components';
    }

    public get componentFactories(): Iterable<FactoryEntry> {
        return this._componentFactoriesEntries.values();
    }

    public postProcess(): void {
        this.componentsMetadata=[...this._getComponentsMetaData()];
    }

    public registerComponentFactory(componentFactory:ComponentFactoryBase): void {
        this.ensureOnDispatchLoop(() => {
            Guard.isDefined(componentFactory, 'componentFactory must be defined');
            let metadata:ComponentFactoryMetadata = getComponentFactoryMetadata(componentFactory);
            Guard.isFalse(this._componentFactoriesEntries.hasOwnProperty(metadata.componentKey), `component with id [${metadata.componentKey}] already added`);
            _log.debug(`registering component factory with key [${metadata.componentKey}], shortname [${metadata.shortName}]`);
            this._componentFactoriesEntries.set(metadata.componentKey, {
                componentFactoryKey: metadata.componentKey,
                factory: componentFactory,
                shortName: metadata.shortName,
                isWorkspaceItem: metadata.showInAddComponentMenu
            });            
        });
    }

    public unregisterComponentFactory(componentFactory:ComponentFactoryBase): void {
        this.ensureOnDispatchLoop(() => {
            let metadata:ComponentFactoryMetadata = getComponentFactoryMetadata(componentFactory);
            Guard.isDefined(componentFactory, 'componentFactory must be defined');
            _log.debug(`unregistering component factory with componentFactoryKey [${metadata.componentKey}]`);
            this._componentFactoriesEntries.delete(metadata.componentKey);
        });        
    }
    
    @observeEvent('createComponent')
    private _onCreateComponent(event): void {
        _log.verbose('Creating component with id {0}', event.componentFactoryKey);
        this._createComponent(event.componentFactoryKey);
    }

    public getComponentFactory(componentFactoryKey:string): ComponentFactoryBase {
        Guard.isFalse(this._componentFactoriesEntries.has(componentFactoryKey), `component with id [${componentFactoryKey}] already added`);
        let entry : FactoryEntry = this._componentFactoriesEntries.get(componentFactoryKey);
        Guard.isDefined(entry, `componentFactory with key ${componentFactoryKey} not registered`);
        return entry.factory; 
    }

    private *_getComponentsMetaData() : IterableIterator<ComponentMetadata> {
        for(let entry of this._componentFactoriesEntries.values()) {
            yield {
                componentFactoryKey: entry.componentFactoryKey,
                shortName: entry.shortName,
                isWorkspaceItem: entry.isWorkspaceItem
            };
        }
    }

    private _createComponent(componentFactoryKey: string): void {
        this._ensureComponentRegistered(componentFactoryKey);
        let entry = this._componentFactoriesEntries.get(componentFactoryKey);
        entry.factory.createComponent();
    }

    private _ensureComponentRegistered(componentFactoryKey: string): void {
        Guard.isTrue(this._componentFactoriesEntries.has(componentFactoryKey), `component with id [${componentFactoryKey}] not registered`);
    }
}
