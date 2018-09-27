---
layout: post
title: Forget about checked exceptions
date: 2018-07-27T18:00:00+03:00
---

Checked exceptions vs. unchecked exceptions. I know this kind of discussion is a bit old and raised 
many times. Someone says checked exceptions are evil. Someone says they are reasonable sometimes. Then suddenly 
Yegor Bugayenko came with his Elegant Objects and [claimed](https://www.yegor256.com/2015/07/28/checked-vs-unchecked-exceptions.html) 
that it's actually unchecked exceptions that are evil, and checked exceptions must be used instead.

At first I was convinced. I liked the idea to have a clear mark on unsafe methods, which will say to the client code 
that it must be prepared to deal with possible errors. But for some reason the rules, outlined in the article, just 
weren't working. I mean---at all. No matter how hard I tried, at some point I ended up with 90% of codebase which 
`throws Exception`. After some analysis I came to interesting conclusion: we can argue about "checked vs. unchecked 
exceptions" in general, but for "Elegant Objects" way of OOP, checked exceptions are just inapplicable. Forget about 
them.

Consider the following interface:

```java
interface Fraction {
    int numerator();
    int denominator();
}
```

Cosy little interface, with clear meaning and cohesive set of methods. A [simple fraction](https://en.wikipedia.org/wiki/Fraction_(mathematics)). 
We can easily make some implementations of it for fractions and operations on them.
 
A fraction with fixed numerator and denominator:

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
```

A fraction got from a sum of two fractions:

```java
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
```

A fraction got from multiplication of two fractions:

```java
class FracMultiply implements Fraction {
    private final Fraction left;
    private final Fraction right;

    public FracMultiply(Fraction left, Fraction right) {
        this.left = left;
        this.right = right;
    }

    public final int numerator() {
        return left.numerator() * right.numerator();
    }

    public final int denominator() {
        return left.denominator() * right.denominator();
    }
}
```

And we can use all of them by composing together in elegant way:

```java
public class Main {
    public static void main(String... args) {
        FracSum sum = new FracSum(
            new FracStatic(1, 2),
            new FracStatic(1, 3)
        );
        System.out.println(
            sum.numerator() + "/" + sum.denominator()
        ); /* 5/6 */
    }
}
```

However, all these implementations were rather simple. Let's try more complex example. What if we need to implement a 
fraction, parsed from some file contents, for instance:

```java
/**
 * Fraction, parsed from file contents. Expects a line in format
 * '[0-9]+/[0-9]+'.
 */
class FracFromFile implements Fraction {
    private final File file;

    public FracFromFile(File file) {
        this.file = file;
    }

    public final int numerator() {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[0]
            );
        }
    }

    public final int denominator() {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[1]
            );
        }
    }
}
```

The example above won't even compile. Because calls on `Reader` instances may throw checked exceptions. They are 
unsafe. The same problem awaits us if we decide to implement [SQL-speaking](https://www.yegor256.com/2014/12/01/orm-offensive-anti-pattern.html#sql-speaking-objects)
fraction, for instance.

No matter how hard we try, we won't be able to implement our `Fraction` interface for such cases without breaking the
rules. Unsafe nature of underlying mechanisms like IO streams, NIO streams, JDBC, network sockets 
immediately makes any implementation that uses them unsafe. This fact forces implementor to follow one of the ways:

**Add `throws Exception` to the interface method's declaration?**

```java
interface Fraction {
    int numerator() throws Exception;
    int denominator() throws Exception;
}

class FracFromFile implements Fraction {
    private final File file;

    public FracFromFile(File file) {
        this.file = file;
    }

    public final int numerator() throws Exception {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[0]
            );
        }
    }

    public final int denominator() throws Exception {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[1]
            );
        }
    }
}
```

Such solution has a domino effect on all implementations: they will use the same "unsafe" declaration even when 
they are actually safe. Moreover, unsafe nature of `Fraction` interface will impact other interfaces, if their 
implementations use `Fraction` instances as method arguments or class fields.

**Make a separate interface with unsafe methods, and implement all unsafe classes using `FractionUnsafe`?**

```java
interface FractionUnsafe {
    int numerator() throws Exception;
    int denominator() throws Exception;
}

class FracFromFile implements FractionUnsafe {
    private final File file;

    public FracFromFile(File file) {
        this.file = file;
    }

    public final int numerator() throws Exception {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[0]
            );
        }
    }

    public final int denominator() throws Exception {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[1]
            );
        }
    }
}
```

But what about `FracSum` from the initial example? It is sum of `Fraction`'s, not `FractionUnsafe`'s. In other words, 
such path severely harms polymorphism: classes which uses `Fraction` as method arguments or class fields won't be 
applicable for classes implemented from `FractionUnsafe`.

**Be a sinner, by suppressing exceptions, or wrapping them to runtime exceptions?**

```java
class FracFromFile implements Fraction {
    private final File file;

    public FracFromFile(File file) {
        this.file = file;
    }

    public final int numerator() {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[0]
            );
        } catch(Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public final int denominator() {
        try(BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return Integer.parseInt(
                reader.readLine().split("/")[1]
            );
        } catch(Exception ex) {
            throw new RuntimeException(ex);
        }
    }
}
```

Suppressing exceptions is just wrong: never use exceptions for control flow (at least until you can). Wrapping 
exceptions (like in example above) is a direct contradiction to Yegor's own principles. But it feels less harmful and
more sane than the previous two ways.

## Why so?

Checked exceptions has one problem, and this problem neglects all the benefits Yegor outlined in 
his blogpost. The problem is---when in some interface we define a fact that some method is safe or unsafe, we make an
implicit assumption on the future implementations' internals. Usually such details are supposed to be encapsulated. 
This leads to inflexible interfaces, which are hard to extend. And it additionally couples the objects to each other. 

And what for? Why client code should care about possible failures from the object it communicates with, if it is not
supposed to handle them? Flow control through exceptions is evil, nobody cancelled this rule. So if client code cannot 
control exceptional situations, what is the reason to notify clients of some class of their presence?

To say more, is there such differentiation as safe or unsafe code? Let's check this example:
```java
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

It's fraction too. It's like `FracFromFile`, but parses string instead of file. It will compile as-is, but it has plenty
of ways to fail. The failure may be trivial, like `NullPointerException` on attempt to parse null, or some 
parsing exception on empty or improperly-formatted string. Or something more dreadful may happen, like 
`OutOfMemoryError`. Who knows? So is there any code which can be considered safe?

Forget about checked exceptions. Always panic through runtime exceptions when you code in "Elegant" way. 
Consider no code as safe, it is only honest.
