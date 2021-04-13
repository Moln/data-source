import {
  entries,
  IArrayDidChange,
  IMapDidChange,
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  IValueWillChange,
  observe,
  values,
  IArrayWillChange,
  IArrayWillSplice,
  IInterceptor,
} from 'mobx';

type IDisposer = () => void;

type IChange = IObjectDidChange | IArrayDidChange | IMapDidChange;

type Entry = {
  dispose: IDisposer;
  path: string;
  parent: Entry | undefined;
};

function buildPath(entry: Entry | undefined): string[] {
  if (!entry) return [];
  const res: string[] = [];
  while (entry.parent) {
    res.push(entry.path);
    entry = entry.parent;
  }
  return res.reverse();
}

function isRecursivelyObservable(thing: any) {
  return (
    isObservableObject(thing) ||
    isObservableArray(thing) ||
    isObservableMap(thing)
  );
}

function processChangeCall(
  fnRecursively: (thing: any, parent: Entry, name: string) => void,
  unfnRecursively: (thing: any) => void,
  entrySet: WeakMap<any, Entry>
) {
  return function(change: IChange, parent: Entry) {
    switch (change.type) {
      // Object changes
      case 'add': // also for map
        fnRecursively(change.newValue, parent, change.name);
        break;
      case 'update': // also for array and map
        unfnRecursively(change.oldValue);
        fnRecursively(
          change.newValue,
          parent,
          (change as any).name || '' + (change as any).index
        );
        break;
      case 'remove': // object
      case 'delete': // map
        unfnRecursively(change.oldValue);
        break;
      // Array changes
      case 'splice':
        change.removed.map(unfnRecursively);
        change.added.forEach((value, idx) =>
          fnRecursively(value, parent, '' + (change.index + idx))
        );
        // update paths
        for (
          let i = change.index + change.addedCount;
          i < change.object.length;
          i++
        ) {
          if (isRecursivelyObservable(change.object[i])) {
            const entry = entrySet.get(change.object[i]);
            if (entry) entry.path = '' + i;
          }
        }
        break;
    }
  };
}

export function deepObserve<T = any>(
  target: T,
  listener: (change: IChange, path: string[], root: T) => void
): IDisposer {
  const entrySet = new WeakMap<any, Entry>();

  const processChange = processChangeCall(
    observeRecursively,
    unobserveRecursively,
    entrySet
  );

  function genericListener(change: IChange) {
    const entry = entrySet.get(change.object)!;
    processChange(change, entry);
    listener(change, buildPath(entry), target);
  }

  function observeRecursively(
    thing: any,
    parent: Entry | undefined,
    path: string
  ) {
    if (isRecursivelyObservable(thing)) {
      const entry = entrySet.get(thing);
      if (entry) {
        if (entry.parent !== parent || entry.path !== path)
          // MWE: this constraint is artificial, and this tool could be made to work with cycles,
          // but it increases administration complexity, has tricky edge cases and the meaning of 'path'
          // would become less clear. So doesn't seem to be needed for now
          throw new Error(
            `The same observable object cannot appear twice in the same tree,` +
              ` trying to assign it to '${buildPath(parent)}/${path}',` +
              ` but it already exists at '${buildPath(entry.parent)}/${
                entry.path
              }'`
          );
      } else {
        const entry = {
          parent,
          path,
          dispose: observe(thing, genericListener),
        };
        entrySet.set(thing, entry);
        entries(thing).forEach(([key, value]) =>
          observeRecursively(value, entry, key)
        );
      }
    }
  }

  function unobserveRecursively(thing: any) {
    if (isRecursivelyObservable(thing)) {
      const entry = entrySet.get(thing);
      if (!entry) return;
      entrySet.delete(thing);
      entry.dispose();
      values(thing).forEach(unobserveRecursively);
    }
  }

  observeRecursively(target, undefined, '');

  return () => {
    unobserveRecursively(target);
  };
}

type IInterceptHandler<T> = IInterceptor<
  | IObjectWillChange<T>
  | IArrayWillChange<T>
  | IArrayWillSplice<T>
  | IValueWillChange<T>
>;
type IInterceptChange<T> = Parameters<IInterceptHandler<T>>[0];

export function deepIntercept<T = any>(
  target: T,
  listener: (
    change: IInterceptChange<T>,
    path: string[],
    root: T
  ) => IInterceptChange<T> | null
): IDisposer {
  const entrySet = new WeakMap<any, Entry>();

  const processChange = processChangeCall(
    interceptRecursively,
    uninterceptRecursively,
    entrySet
  );

  deepObserve(target, change => {
    const parent = entrySet.get(change.object)!;
    processChange(change, parent);
  });

  function interceptRecursively(
    thing: any,
    parent: Entry | undefined,
    path: string
  ) {
    if (isRecursivelyObservable(thing)) {
      const entry = entrySet.get(thing);
      if (entry) {
        if (entry.parent !== parent || entry.path !== path)
          // MWE: this constraint is artificial, and this tool could be made to work with cycles,
          // but it increases administration complexity, has tricky edge cases and the meaning of 'path'
          // would become less clear. So doesn't seem to be needed for now
          throw new Error(
            `The same intercept object cannot appear twice in the same tree,` +
              ` trying to assign it to '${buildPath(parent)}/${path}',` +
              ` but it already exists at '${buildPath(entry.parent)}/${
                entry.path
              }'`
          );
      } else {
        const entry = {
          parent,
          path,
          dispose: intercept<T>(thing, change => {
            const entry = entrySet.get(change.object)!;
            return listener(change, buildPath(entry), target) as any;
          }),
        };
        entrySet.set(thing, entry);
        entries(thing).forEach(([key, value]) =>
          interceptRecursively(value, entry, key)
        );
      }
    }
  }

  function uninterceptRecursively(thing: any) {
    if (isRecursivelyObservable(thing)) {
      const entry = entrySet.get(thing);
      if (!entry) return;
      entrySet.delete(thing);
      entry.dispose();
      values(thing).forEach(uninterceptRecursively);
    }
  }

  interceptRecursively(target, undefined, '');

  return () => {
    uninterceptRecursively(target);
  };
}
