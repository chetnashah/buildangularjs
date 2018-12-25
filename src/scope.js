// function reference is only equal to itself
function initWatchVal(){

}

function Scope(){
    // scope needs to store all watchers
    // $$ means private to angularjs framework
    this.$$watchers = [];
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$postDigestQueue = [];
    this.$$applyAsyncId = null;
    this.$$phase = '';
}

// listener function can modify scope values
// listener function can also add another watchers using $watch
// listenr function can modify scope in cyclic fashion to create deadlock
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
    // watch registration happens here, add them to list of watchers
    // these functions are only called during digest cycle
    this.$$watchers.push({
        watchFn: watchFn,
        listenerFn: listenerFn || function(){},
        valueEq: !!valueEq,
        last: initWatchVal
    });
    // lastdirtywatch stores last dirty watcher in the list  at a scope level
    // also reset this scope level variable when any new watcher is added.
    this.$$lastDirtyWatch = null;
}

Scope.prototype.$$areEqual = function(newVal, oldVal, valueEq) {
    // simple isNaN(undefined) is true
    // we want to explicitly check for NaN so we use Number.isNaN
    if(Number.isNaN(newVal) && Number.isNaN(oldVal)){
        return true;
    }
    if(valueEq) {
        return _.isEqual(newVal, oldVal);
    } else {
        return newVal === oldVal;
    }
}

// runs all watchers once (along with triggering listeners if necessary) and
// returns a boolean telling if something was dirty
Scope.prototype.$$digestOnce = function(){
    // process each watcher in list of watchers
    var self = this;
    var oldVal, newVal, dirty;
    // every registered watch function is called in digest cycle
    _.forEach(this.$$watchers, function(watcher){
        // try-catch because execution of one watch
        // should not break other watches
        try {
            oldVal = watcher.last;// we remember last value in the watcher
            newVal = watcher.watchFn(self);
        // console.log(newVal, oldVal);
            if(!self.$$areEqual(newVal, oldVal, watcher.valueEq)){
                self.$$lastDirtyWatch = watcher;
                watcher.last = watcher.valueEq ? _.cloneDeep(newVal) : newVal;
                // when going from initVal to any other val
                // return same for both newVal and oldVal
                watcher.listenerFn(newVal, oldVal === initWatchVal ? newVal : oldVal, self);
                dirty = true;
            } else if (self.$$lastDirtyWatch === watcher) {
                return false;
            }
        } catch (error) {
            console.error('error = ', error);
            return;
        }
    });
    return dirty;
}

// runs at least once - all the watchers
// keep digesting while dirty
Scope.prototype.$digest = function(){
    this.$beginPhase('$digest');// digest phase begins
    var ttl = 10;
    debugger;
    this.$$lastDirtyWatch = null;

    // flush & clear applyAsync functions if present
    if (this.$$applyAsyncId) {
        clearTimeout(this.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

   var dirty = this.$$digestOnce();
   console.trace('outside');
   console.log('outside dirty = ', dirty);
   while((dirty && ttl--) || (this.$$asyncQueue.length && ttl--)){
      console.log('inside - asyncQueue.len = ', this.$$asyncQueue.length);
      // bcoz evalAsync exprs are part of a digest cycle.
      while(this.$$asyncQueue.length) {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      }
      dirty = this.$$digestOnce();
      console.log('inside dirty = ', dirty);
   }
   this.$clearPhase();
   if (ttl <= 0) {
       throw new Error('Reached TTL limit');
   }
   while(this.$$postDigestQueue.length) {
       // we do not trigger anything
       try {
           this.$$postDigestQueue.shift()();
       } catch (error) {
           console.error('postdigest expr error - ', error);
       }
   }
}

/**
 * $apply: ((scope) => any) => any
 */
Scope.prototype.$apply = function(expr) {
    var result;
    try {
        this.$beginPhase('$apply'); // apply phase begins
        result = this.$eval(expr);
    } catch(err) {
        console.err('some error happened : ', err);
    } finally {
        this.$clearPhase(); // apply phase ends
        this.$digest(); // run digest phase after apply phase
        return result;
    }
}

// call all functions in applyAsyncQueue
Scope.prototype.$$flushApplyAsync = function(){
    while(this.$$applyAsyncQueue.length) {
        this.$$applyAsyncQueue.shift()();
    }
    this.$$applyAsyncId = null;
}

// unlike evalAsync, applyAsync does not execute in same digest
// batches multiple invocations and is flushed if digest happens before it.
Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    // defering by putting eval-expr in func
    self.$$applyAsyncQueue.push(function(){
        self.$eval(expr);
    });
    // we are not calling digest
    // we are letting all digest finish and run all jobs in a single $apply
    if (!this.$$applyAsyncId) {
        this.$$applyAsyncId = setTimeout(function(){
            self.$apply(_.bind(self.$$flushApplyAsync, self))
        }, 0); 
    }
}

//this triggers a $digest if not already present
// schedules expr to run later, but still in the same digest.
Scope.prototype.$evalAsync = function(expr) {
    var self = this;
    // check if no phase is running and no task pending b4 adding task
    if(!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function(){
            if (self.$$asyncQueue.length) {
                self.$digest();
            }
        }, 0);
    }
    this.$$asyncQueue.push({scope: this, expression: expr});
}

/**
 * $eval: ((scope) => any, locals) => any
 */
Scope.prototype.$eval = function(expr, locals) {
    return expr(this, locals);
}

// we have a begin phase and a clear phase
Scope.prototype.$beginPhase = function(phase){
    if(this.$$phase) {
        throw this.$$phase + ' already in progress';
    }
    this.$$phase = phase;
}

// set this.$$phase to null
Scope.prototype.$clearPhase = function(phase) {
    this.$$phase = null;
}

Scope.prototype.$$postDigest = function(expr) {
    this.$$postDigestQueue.push(expr);
}

// there are two places where
// exceptions can happen, 