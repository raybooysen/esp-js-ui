import * as Rx from 'rx';
import {DisposableBase} from 'esp-js';
import PrerequisiteRegistrar from './prerequisiteRegistrar';
import {LoadResult, ResultStage} from './loadResult';
import Logger from '../../../core/logger';
import Unit from '../../../core/unit';

export default class DefaultPrerequisiteRegistrar extends DisposableBase implements PrerequisiteRegistrar  {
    private _stream: Rx.Observable<LoadResult> = Rx.Observable.empty<LoadResult>();
    private _publishedStream: Rx.Observable<LoadResult>;
    private _log: Logger = Logger.create('PrerequisiteRegistrar');

    constructor() {
        super();

        let loadDisposable = new Rx.SingleAssignmentDisposable();
        this.addDisposable(loadDisposable);

        this._stream = Rx.Observable.empty<LoadResult>();
        this._publishedStream = Rx.Observable.defer<LoadResult>(() => {
            // We close over _stream so that we allow the class to modify
            // it (see registerStream function)
            return this._stream;
        })
        // When we load, stop on the first error result we get
        // But yield it back to the consumer so they know it stopped
        .takeUntilInclusive((result: LoadResult) =>  result.stage === ResultStage.Error)
        .multicast(new Rx.ReplaySubject<LoadResult>(1))
        .lazyConnect<LoadResult>(loadDisposable);
    }

    public registerAction(action: () => void, name: string, errorMessage?: (e: Error) => string): void {
        let stream = Rx.Observable.create<any>(obs => {
            action();
            obs.onNext(Unit.default);
            obs.onCompleted();
        });
        this.registerStream(stream, name, errorMessage);
    }

    public load(): Rx.Observable<LoadResult> {
        // We have to assume that if someone calls load,
        // all streams /actions have been registered.
        return this._publishedStream;
    }

    public registerStreamFactory(factory: () => Rx.Observable<Unit>, name: string): void {
        return this.registerStream(Rx.Observable.defer(() => factory()), name);
    }

    public registerStream(stream: Rx.Observable<Unit>, name: string, errorMessage?: (e: Error) => string): void {
        let builtStream = this._buildStream(stream, name, errorMessage);
        this._stream = this._stream.concat(builtStream);
    }

    private _buildStream(stream: Rx.Observable<Unit>, name: string, errorMessage: (e: Error) => string = e => e.message) : Rx.Observable<LoadResult> {
        return Rx.Observable.create<LoadResult>(obs => {
            obs.onNext({
                stage: ResultStage.Starting,
                name
            });

            let handleError = (e: Error) => {
                let message = `Error in async load for ${name}`;
                this._log.error(message, e);
                obs.onNext({
                    stage: ResultStage.Error,
                    name,
                    errorMessage: errorMessage(e)
                });
                obs.onCompleted();
            };

            return stream
                .take(1)
                .ignoreElements()
                .subscribe(
                    _ => {
                    },
                    e => handleError(e),
                    () => {
                        obs.onNext({
                            stage: ResultStage.Completed,
                            name
                        });
                        obs.onCompleted();
                    }
                );
        });
    }
}