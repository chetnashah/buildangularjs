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
        
        it('short circuits on a clean watch', function(){
            scope.array = _.range(100);
            var watchExecutions = 0;

            // setup watcher for each element in array
            _.times(100, function(i){
                scope.$watch(
                    function(sc){ watchExecutions++; return sc.array[i];},
                    function(newVal, oldVal, sc){}
                );
            });

            scope.$digest();
            expect(watchExecutions).toBe(200);

            scope.array[0] = 1;
            scope.$digest();
            expect(watchExecutions).toBe(301);

        });

        it('does not end digest, and lets new watchers e.g. added in listeners also run', function(){
            scope.someValue = 'a';
            scope.ctr = 0;

            scope.$watch(
                function(sc) { return sc.someValue; },
                function(newVal, oldVal, sc) {
                    console.log('oldVal = ', oldVal);
                    console.log('newVal = ', newVal);
                    scope.$watch(
                        function(sc2) { return sc2.someValue; },
                        function(newVal2, oldVal2, sc2){
                            sc2.ctr++;
                        }
                    )
                }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);
            
        });

        it(' supports value equality watching instead of references', function(){
            scope.arr = [1,2,3];
            scope.ctr = 0;
            scope.$watch(
                function(sc) { return sc.arr; },
                function(newVal, oldVal, sc) {
                    console.log('arr changed, arr = ', newVal);
                    scope.ctr++;
                },
                true
            );
            scope.$digest();
            expect(scope.ctr).toBe(1);

            scope.arr[2] = -1;
            scope.$digest();
            expect(scope.ctr).toBe(2);

            
        });

        it('correctly handles NaNs', function(){
            scope.n = 0/0;// NaN
            scope.ctr = 0;
            scope.$watch(
                function(sc) { return sc.n; },
                function(newVal, oldVal, sc){
                    sc.ctr++;
                }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);

            scope.$digest();
            expect(scope.ctr).toBe(1);
        });
    });

    describe('$eval', function(){
        var scope;
        beforeEach(function(){
            scope = new Scope();
        });

        it('executes evaled function and returns the result', function(){
            scope.a = 42;
            var result = scope.$eval(
                function(sc){
                    return sc.a;
                }
            );

            expect(result).toBe(42);

            // should pass the locals as is
            var res2 = scope.$eval(
                function(sc, locals) { return sc.a + locals; },
                8
            );

            expect(res2).toBe(50);
        });

        it('executes apply\'ed function and runs digest', function(){
            scope.val = 'aval';
            scope.ctr = 0;

            scope.$watch(
                function(sc) { return sc.val; },
                function(newVal, oldVal, sc) { sc.ctr++; }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);

            scope.$apply(function(sc){
                sc.val = 'bval';
            });
            expect(scope.ctr).toBe(2);
        });

        it("executes $evalAsync'ed code later in the same digest", function(){
            scope.aval = 'a';
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;

            scope.$watch(
                function(sc) { return sc.aval; },
                function(newVal, oldVal, sc) {
                    sc.$evalAsync(function(sc){
                        sc.asyncEvaluated = true;
                    });
                    sc.asyncEvaluatedImmediately = sc.asyncEvaluated;
                }
            );

            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmediately).toBe(false);
        });

        it('eventually halts tasks added by evalAsync in watch functions', function(){
            scope.aval = 'a';
           
            scope.$watch(
                function(sc){
                    sc.$evalAsync(function(sc){ });
                    return sc.aval;
                },
                function(newVal, oldVal, sc) {}
            );

            expect(function(){ scope.$digest() }).toThrow();
        });

        it('has a $$phase field whose value is the current digest phase', function(){
            scope.avalue = 'a';
            scope.phaseInWatchFunction = undefined;
            scope.phaseInListenerFunction = undefined;
            scope.phaseInApplyFunction = undefined;

            scope.$watch(
                function(sc){
                    sc.phaseInWatchFunction = sc.$$phase;
                    return sc.avalue;
                },
                function(newVal, oldVal, sc) {
                    scope.phaseInListenerFunction = sc.$$phase;
                }
            );

            scope.$apply(function(sc){
                scope.phaseInApplyFunction = sc.$$phase;
            });

            expect(scope.phaseInWatchFunction).toBe('$digest');
            expect(scope.phaseInListenerFunction).toBe('$digest');
            expect(scope.phaseInApplyFunction).toBe('$apply');

        });

        it('shedules a digest when $evalAsync is used', function(done){
            scope.a = 'a';
            scope.ctr = 0;

            scope.$watch(
                function(sc){ return sc.a; },
                function(newVal, oldVal, sc){
                    sc.ctr++;
                }
            );

            scope.$evalAsync(function(){ });

            expect(scope.ctr).toBe(0);
            setTimeout(function(){
                expect(scope.ctr).toBe(1);
                done();
            }, 50);
        });

        it('allows async $apply via $applyAsync', function(done){
            scope.aval = 'a';
            scope.ctr = 0;

            scope.$watch(
                function(sc) { return scope.aval; },
                function(newVal, oldVal, sc) {
                    sc.ctr++;
                }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);

            scope.$applyAsync(function(sc){
                sc.aval = 'b';
            });
            expect(scope.ctr).toBe(1);
            setTimeout(function(){
                expect(scope.ctr).toBe(2);
                done();
            },50);
        });

        it("never executes $applyAsync'ed function in the same digest cycle where it used", function(done){
            scope.aval = 'a';
            scope.asyncApplied = false;

            scope.$watch(
                function(sc) { return sc.aval; },
                function(newVal, oldVal, sc) {
                    scope.$applyAsync(function(sc){// applyAsync schedules its own apply via timeout
                        sc.asyncApplied = true;
                    });
                }
            );

            scope.$digest();
            // no change after digest, apply will run it's own digest & process tasks
            expect(scope.asyncApplied).toBe(false);
            setTimeout(function(){
                expect(scope.asyncApplied).toBe(true);
                done();
            }, 50);
        });

        it('coalasces many calls to $applyAsync', function(done){
            scope.watchCtr = 0;
            scope.listenCtr = 0;

            scope.$watch(
                function(sc) { sc.watchCtr++; return sc.aval; },
                function(newVal, oldVal, sc) { sc.listenCtr++; }
            );

            scope.$applyAsync(function(sc){
                sc.aval = 'abc';
            });
            scope.$applyAsync(function(sc){
                sc.aval = 'def';
            });

            setTimeout(function(){
                expect(scope.watchCtr).toBe(2);
                expect(scope.listenCtr).toBe(1);
                done();
            }, 20);
        });

        it('flushes applyAsync calls(execute synchronously) if digest is run', function(done){
            scope.watchCtr =0;

            scope.$watch(
                function(sc) {
                    sc.watchCtr++;
                    return sc.aVal;
                },
                function(newVal, oldVal, sc) { }
            );

            scope.$applyAsync(function(sc){
                sc.aVal="abc";
            });
            scope.$applyAsync(function(sc){
                sc.aVal = 'def';
            });

            scope.$digest();
            expect(scope.watchCtr).toBe(2);
            expect(scope.aVal).toBe('def');

            setTimeout(function(){
                expect(scope.watchCtr).toBe(2);
                done();
            }, 50);
        });

        it('calls postDigest after digest is over', function(done){
            scope.ctr = 0;

            scope.$$postDigest(function(){
                scope.ctr++;
            });

            expect(scope.ctr).toBe(0);
            
            scope.$digest();
            expect(scope.ctr).toBe(1);
            
            scope.$digest();
            expect(scope.ctr).toBe(1);
            done();
        });

        it('does not include $$postDigest in the digest', function(done) {
            scope.aval = 'original value';

            scope.$$postDigest(function(){
                scope.aval = 'changed value';
            });

            scope.$watch(
                function(sc){ return sc.aval; },
                function(newVal, oldVal, sc) {
                    sc.watchedVal = newVal;
                }
            );

            scope.$digest();
            expect(scope.watchedVal).toBe('original value');

            scope.$digest()
            expect(scope.watchedVal).toBe('changed value');
            done();
        });

        it('catches exceptions in watch functions and continues', function(done){
            scope.aval = 'abc';
            scope.ctr = 0;

            scope.$watch(
                function(sc){ throw "error"; },
                function(newVal, oldVal, sc){ }
            );
            scope.$watch(
                function(sc) { return sc.aval; },
                function(newVal, oldVal, sc){ sc.ctr++; }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);
            done();
        });

        it('catches errors in listener functions and continues', function(done){
            scope.aval = 'abc';
            scope.ctr = 0;

            scope.$watch(
                function(sc) { return sc.aval; },
                function(newVal, oldVal, sc) { throw "Error"; }
            );

            // this watch should not be affected
            scope.$watch(
                function(sc) { return sc.aval; },
                function(newVal, oldVal, sc) {
                    sc.ctr++;
                }
            );

            scope.$digest();
            expect(scope.ctr).toBe(1);
            done();

        });


        it('catches exceptions in $evalAsync', function(done){
            scope.aval = 'abc';
            scope.ctr = 0;

            scope.$watch(
                function(sc){ return sc.aval; },
                function(newVal, oldVal, sc){
                    sc.ctr++;
                }
            );

            scope.$evalAsync(function(sc){
                throw "Error";
            });

            setTimeout(() => {
                expect(scope.ctr).toBe(1);
                done();
            }, 50);
        });

        it('catches exceptions in $applyAsynv', function(done){
            scope.$applyAsync(function(sc){
                throw "Error";
            });

            scope.$applyAsync(function(sc){
                throw "Error";
            });

            scope.$applyAsync(function(sc){
                sc.applied = true;
            });

            setTimeout(() => {
                expect(scope.applied).toBe(true);
                done();
            }, 50);
        });

        it('catches exceptions in $$postDigest', function(){
            var didRun = false;

            scope.$$postDigest(function(){
                throw "error!";
            });
            scope.$$postDigest(function(){
                throw "Error";
            });
            scope.$$postDigest(function(){
                didRun = true;
            });

            scope.$digest();
            expect(didRun).toBe(true);
            done();
        });

    })
});
