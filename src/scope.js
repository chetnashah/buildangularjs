// function reference is only equal to itself
function initWatchVal(){

}

function Scope(){
    // scope needs to store all watchers
    // $$ means private to angularjs framework
    this.$$watchers = [];
}


Scope.prototype.$watch = function(watchFn, listenerFn) {
    // watch registration happens here, add them to list of watchers
    // these functions are only called during digest cycle
    this.$$watchers.push({
        watchFn: watchFn,
        listenerFn: listenerFn || function(){},
        last: initWatchVal
    });
}


// runs all watchers once and
// returns a boolean telling if something was dirty
Scope.prototype.$$digestOnce = function(){
    // process each watcher in list of watchers
    var self = this;
    var oldVal, newVal, dirty;
    // every registered watch function is called in digest cycle
    _.forEach(this.$$watchers, function(watcher){
        oldVal = watcher.last;// we remember last value in the watcher
        newVal = watcher.watchFn(self);
        // console.log(newVal, oldVal);
        if(newVal != oldVal){
            watcher.last = newVal;
            dirty = true;
            // when going from initVal to any other val
            // return same for both newVal and oldVal
            watcher.listenerFn(newVal, oldVal === initWatchVal ? newVal : oldVal, self);
        }
    });
    return dirty;
}

// runs at least once - all the watchers
// keep digesting while dirty
Scope.prototype.$digest = function(){
    var ttl = 10;
   var dirty = this.$$digestOnce();
   while(dirty && ttl--){
       dirty = this.$$digestOnce();
   }
   if (ttl <= 0) {
       throw new Error('Reached TTL limit');
   }

}