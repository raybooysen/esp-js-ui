import { Router, observeEvent } from 'esp-js';
import { Logger, Guard } from '../../core';
import ModelBase from '../modelBase';
import { getComponentFactoryMetadata, ComponentFactoryMetadata } from './index';
import ComponentFactoryBase from './componentFactoryBase';
import IdFactory from '../idFactory';

let _log = Logger.create('ComponentRegistryModel');

export interface ComponentMetadata {
    componentFactoryKey: string;
    shortName: string;
}

export interface FactoryEntry {
    componentFactoryKey: string;
    factory: ComponentFactoryBase;
    shortName: string;
}

interface KeyToFactoryEntryMap {
    [key: string]: FactoryEntry;
}

export default class ComponentRegistryModel extends ModelBase {
    private _componentFactoriesEntries: KeyToFactoryEntryMap = {};
    public componentsMetadata: Array<ComponentMetadata>;

    constructor(router:Router) {
        super(IdFactory.createId('component-registry'), router);
        this.observeEvents();
    }

    public getTitle() : string {
        return 'Components';
    }

    public get componentFactories(): Array<FactoryEntry> {
        let entries = [];
        for (let key in this._componentFactoriesEntries) { //tslint:disable-line
            entries.push(this._componentFactoriesEntries[key]);
        }
        return entries;
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
            this._componentFactoriesEntries[metadata.componentKey] = {
                componentFactoryKey: metadata.componentKey,
                factory: componentFactory,
                shortName: metadata.shortName
            };
        });
    }

    public unregisterComponentFactory(componentFactory:ComponentFactoryBase): void {
        this.ensureOnDispatchLoop(() => {
            let metadata:ComponentFactoryMetadata = getComponentFactoryMetadata(componentFactory);
            Guard.isDefined(componentFactory, 'componentFactory must be defined');
            _log.debug(`unregistering component factory with componentFactoryKey [${metadata.componentKey}]`);
            delete this._componentFactoriesEntries[metadata.componentKey];
        });        
    }
    
    @observeEvent('createComponent')
    private _onCreateComponent(event): void {
        _log.verbose('Creating component with id {0}', event.componentFactoryKey);
        this._createComponent(event.componentFactoryKey);
    }

    public getComponentFactory(componentFactoryKey:string): ComponentFactoryBase {
        Guard.isFalse((componentFactoryKey in this._componentFactoriesEntries), `component with id [${componentFactoryKey}] already added`);
        let entry : FactoryEntry = this._componentFactoriesEntries[componentFactoryKey];
        Guard.isDefined(entry, `componentFactory with key ${componentFactoryKey} not registered`);
        return entry.factory; 
    }

    private _getComponentsMetaData() : Array<ComponentMetadata> {
        let entries = [];
        for (let key in this._componentFactoriesEntries) { //tslint:disable-line
            let entry = this._componentFactoriesEntries[key];
            entries.push({
                componentFactoryKey: entry.componentFactoryKey,
                shortName: entry.shortName
            });
        }
        return entries;
    }

    private _createComponent(componentFactoryKey: string): void {
        this._ensureComponentRegistered(componentFactoryKey);
        let entry = this._componentFactoriesEntries[componentFactoryKey];
        entry.factory.createComponent();
    }

    private _ensureComponentRegistered(componentFactoryKey: string): void {
        Guard.isTrue((componentFactoryKey in this._componentFactoriesEntries), `component with id [${componentFactoryKey}] not registered`);
    }
}
