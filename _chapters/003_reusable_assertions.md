---
layout: post
title: Reusable assertions
date: 2018-09-19T00:00:00+03:00
---

When reading "Elegant object" materials about testing, I was always asking myself: why the tests should look so 
procedural? Usually, class of a typical JUnit-based test suite is nothing but a bunch of procedures, one per test 
case. I am not criticizing this style, but lets try to make the tests in elegant way and see what profit it may give 
to us?

Let's consider an example:

```java
interface Fraction {
    int numerator();
    int denominator();
}
```

A small highly-segregated interface, representing a simple fraction. One can implement it in several ways... 
oh wait! I am repeating myself. Lets just take some implementations from [here](001_checked_exceptions.html):

```java
class FracStatic implements Fraction {
    private final int numerator;
    private final int denominator;

    public FracStatic(int numerator, int denominator) {
        this.numerator = numerator;
        this.denominator = denominator;
    }

    public final int numerator() {
        return numerator;
    }

    public final int denominator() {
        return denominator;
    }
}

class FracSum implements Fraction {
    private final Fraction left;
    private final Fraction right;

    public FracSum(Fraction left, Fraction right) {
        this.left = left;
        this.right = right;
    }

    public int numerator() {
        final int a = left.numerator() * right.denominator();
        final int b = right.numerator() * left.denominator();
        return a + b;
    }

    public int denominator() {
        return left.denominator() * right.denominator();
    }
}

class FracFromString implements Fraction {
    private final String str;

    public FracFromString(String str) {
        this.str = str;
    }

    public final int numerator() {
        return Integer.parseInt(str.split("/")[0]);
    }

    public final int denominator() {
        return Integer.parseInt(str.split("/")[1]);
    }
}
```

Theoretically, I could make tests suite for each of the class above like this:

```java
class FractionTest {
    @Test
    public void testSumOfTwoFractions() {
        final Fraction sum = new FracSum(
            new FracStatic(1, 2),
            new FracStatic(2, 3)
        );
        assertEquals(5, sum.numerator());
        assertEquals(6, sum.denominator());
    }
    
    @Test
    public void testFractionFromString() {
        final Fraction fraction = new FracFromString("1/2");
        assertEquals(1, sum.numerator());
        assertEquals(2, sum.denominator());
    }
    
    // etc...
}
```

Practically, I am already repeating myself. For each case I am repeating assertions on numerator and denominator. 
Also, two assertions per test is not good enough:
one statement test would be [better](https://www.yegor256.com/2017/05/17/single-statement-unit-tests.html). 

And these were simple examples: what if I take `FracFromFile` or implement an SQL-speaking fraction? I'd need to 
prepare test environment somewhere: create a file for test or bootstrap test database.

## What's the alternative?

Lets start with eliminating the repeating part of the test cases above.
First, let's introduce an `Assertion` interface:

```java
interface Assertion {
    void check() throws Exception;
}
```

Then, lets encapsulate repeating assertions to its implementation:

```java
class AssertFractionHasCertainNumenatorAndDenominator implements Assertion {
    private final Fraction fraction;
    private int expectedNumerator;
    private int expectedDenominator;
    
    public AssertFractionHasCertainNumenatorAndDenominator(Fraction fraction) {
        this.fraction = fraction;
    }
    
    public void check() throws Exception {
        assertEquals(expectedNumerator, fraction.numerator());
        assertEquals(expectedDenominator, fraction.denominator());
    }
}
```

And at last, rewrite the test suite:

```java
class FractionTest extends TestsSuite {
    public FractionTest() {
        super(
            new TestCase(
                "assert that 1/2 + 1/3 = 5/6",
                new AssertFractionHasCertainNumenatorAndDenominator(
                    new FracSum(
                        new FracStatic(1, 2),
                        new FracStatic(2, 3)
                    ),
                    5, 6
                )
            ),
            new TestCase(
                "assert that \"1/2\" string is parsed to a 1/2 fraction",
                new AssertFractionHasCertainNumenatorAndDenominator(
                    new FracFromString("1/2"),
                    1, 2
                )
            )
        );
    }
    
    // etc...
}
```

In the example above, `TestCase` is a certain test case with a single assertion inside, and `TestSuite` is a class 
which executes a sequence of test cases.

### What's the profit?

It all may look meaningless: what is the reason to outline just a couple of assertions to a separate class? 
Isn't it overcomplicating simple things?

I see the following benefits:

- Once implemented, `AssertFractionHasCertainNumenatorAndDenominator` assertion can be used on *any* possible 
subtype of `Fraction`.

- For any highly-segregated interface with clear domain-related semantics (like `Fraction`) the number of 
needed assertions is usually limited. For fraction, single `AssertFractionHasCertainNumenatorAndDenominator` would 
cover the majority of possible test scenarios with fractions. When we test a new `Fraction` implementation, first thing
we would want to test is that fraction under test has certain numerator and denominator.

- `AssertFractionHasCertainNumenatorAndDenominator` assertion, like any other `Assertion` implementations, may be 
released together with the `Fraction` interface, so that developers who extend the solution by providing new 
`Fraction` implementations may reuse its assertions for testing their own stuff.

- `Assertion` implementation may be covered with tests like an ordinary object. Usually, `AssertAssertionPasses` and 
`AssertAssertionFails` are enough to cover all possible assertions in the world.

- `Assertion`'s may be decorated. This is usually useful for scenarios where certain preconditions must be ensured 
before executing original assertion.

- Since assertions may be released together with interfaces and covered with tests, it's not a problem anymore to put a 
complex logic inside assertion or assertion decorator. Wanna bootstrap a test database to cover an SQL-speaking 
object? Why don't make it inside the assertion decorator?

- And finally, no matter how complex is assertion, for the `TestCase` and developer maintaining it, this assertion 
always remains a [single statement](https://www.yegor256.com/2017/05/17/single-statement-unit-tests.html).

### What's the pitfalls?

So far it sound too good to be true. But there are pitfalls which must be taken into account when using this method:

- The interfaces of objects under test must be [highly-segregated](https://en.wikipedia.org/wiki/Interface_segregation_principle).
- The classes under test must be [single-responsible](https://en.wikipedia.org/wiki/Single_responsibility_principle).
- The public contract of the objects under test must be stable.

The reason is the number of invariants of the stuff under test. In case of highly-segregated `Fraction` it's 
simple---we expect it to have certain values for numerator and denominator and that's enough for 90% cases. For each 
such invariant one may write an assertion and use it on each future implementation.

In case of large objects with dozens of methods, like DAO, controllers and services, the number of such invariants is
scaled with each additional method---there will be too many assertions. Also, since the public contract of such
objects is inflexible, these assertions wouldn't be reused effectively. Testing such objects with assertions is 
waste.

Elegant objects, on the other hand, if designed right, usually suit the requirements enumerated above. So, write 
objects in Elegant way, and test them with elegant reusable assertions.

### OO-Tests

The project [OO-Tests](https://github.com/pragmatic-objects/oo-tests) provides starter capabilities for writing 
and testing with reusable assertions. `TestsSuite`, `TestCase` and `Assertion` in the example above are all 
taken from there. Also, it provides a number of common purpose assertions (like `AssertEquals`), and 
`AssertAssertionPassed`/`AssertAssertionFailed`, mentioned in the post. Based on JUnit 5.
