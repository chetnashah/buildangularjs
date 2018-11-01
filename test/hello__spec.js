describe('hello',function(){
    it("says hello to receiver", function(){
        expect(sayHello()({name: 'Jane'})).toBe('Hello, Jane!');
    });
})

