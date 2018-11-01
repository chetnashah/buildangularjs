describe('Scope', function(){
    it('Can be created and acts like a regular Object', function(){
        var scope = new Scope();
        scope.aprop = 1;
        expect(scope.aprop).toBe(1);
    });

    describe('digest', function(){

        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('calls listener function on first digest', function(){
            var watchFn = function(){ return 'wat'; };
            var listenerFn = jasmine.createSpy();

            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            expect(listenerFn).toHaveBeenCalled();
        });

        // general form watch function take is pluck some value from 
        // scope obj to watch. and return it.
        it('calls watch function with scope as its argument', function(){
            var watchFn = jasmine.createSpy();
            var listenerFn = function(){};

            scope.$watch(watchFn, listenerFn);
            scope.$digest();
            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('calls listener function value changes', function(){
            scope.someValue = 'a';
            scope.coutner = 0;

            var watchFn = function(sc) { return sc.someValue; };
            var listenerFn = function(newValue, oldValue, sc) {
                // we are guaranteed that newValue != oldValue
                sc.coutner++;
            };

            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            // first digest triggers listener for going frm
            // undefined -> value
            expect(scope.coutner).toBe(1);

            scope.$digest();
            expect(scope.coutner).toBe(1);

            scope.someValue = 'b';
            expect(scope.coutner).toBe(1);
            scope.$digest();
            expect(scope.coutner).toBe(2);

        });

        it('calls listener when watch value is undefined', function(){
            scope.counter = 0;

            scope.$watch(
                function(sc){ return sc.someValue; },
                function(newVal, oldVal, sc) { sc.counter++; }
            );

            scope.$digest();
            // watcher should trigger even if someValue is undefined
            expect(scope.counter).toBe(1);
        });

        it('calls listener with new value same as old value the first time', function(){
            scope.someValue = 123;
            var ov;
            scope.$watch(
                function(sc){ return sc.someValue; },
                function(newVal, oldVal, sc) {
                    ov = oldVal;   
                }
            );

            scope.$digest();
            expect(ov).toBe(123);
        });

        it('may register watch without a listener function', function(){
            var watchFn = jasmine.createSpy();
            scope.$watch(watchFn); // omitted listener fn

            scope.$digest();
            expect(watchFn).toHaveBeenCalled();
        });

        it('triggers chained watchers in same external digest call', function(){
            scope.name = 'Jane';

            // watch sc.nameUpper -> modify sc.initial
            scope.$watch(
                function(sc){ return sc.nameUpper; },
                function(newVal, oldVal, sc){
                    if (newVal) {
                        sc.initial = newVal.substring(0,1 ) + '.';
                    }
                }
            );

            // watch sc. name -> modify sc.nameUpper
            scope.$watch(
                function(sc){ return sc.name},
                function(newVal, oldVal, sc){
                    if(newVal){
                        sc.nameUpper = newVal.toUpperCase();
                    }
                }
            );

            scope.$digest();// single digest should process chain triggered listeners
            expect(scope.initial).toBe('J.');

            scope.name = 'Bob';
            scope.$digest();
            expect(scope.initial).toBe('B.');
        });

        it('throws when processing an unstable digest after a fixed TTL', function(){
            scope.cntA = 0;
            scope.cntB = 0;

            scope.$watch(
                function(sc){ return sc.cntA; },
                function(newVal, oldVal, sc){
                    sc.cntB++;
                }
            );

            scope.$watch(
                function(sc){ return sc.cntB;} ,
                function(newVal, oldVal, sc){
                    sc.cntA++;
                }
            );

            expect((function(){ scope.$digest(); })).toThrow();
        });

    });
})