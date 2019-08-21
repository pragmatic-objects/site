---
layout: post
title: "Equivalence 101"
description: Full guide on Elegant Objects equivalence
date: 2019-08-21T00:00:00+03:00
---

Some time ago, in the post about [objects equality](004_object_equivalence.html), I slightly touched the subject of the equivalence --- a logic, that is a good candidate to place inside each and every elegantly-designed object's `equals` method.
However, the subject is much deeper then it was covered there. That's why I decided to dedicate a separate post exclusively to the equivalence. I believe that understanding equivalence is crucial for adopting Elegant Objects approach in languages and environments, which were not initially designed for Elegant Objects (like Java).

## Disclaimer

Note that in this post I'll cover only theoretical aspects of equivalence, intentionally omitting its practical usefulness. That's why you may find this post boring and pointless. Yet, it needs to be outlined, because it is fundamental, and I am going to refer to it often in future posts.

## Introduction

In my opinion, one of the most important postulates from "Elegant Objects", which makes it completely different from mainstream understanding of OOP, is that [the objects must be immutable](https://www.yegor256.com/2014/06/09/objects-should-be-immutable.html). However, immutability is mostly the consequence here than the cause. It's not only about making attributes final --- the whole idea behind attributes is reconsidered.

If you search for a definition of what OOP is, you'll most probably find something like this in top results:

> Object-oriented programming (OOP) is a programming paradigm based on the concept of "objects", which can **contain data, in the form of fields (often known as attributes)**, and code, in the form of procedures (often known as methods). A feature of objects is an object's procedures that can access and often modify the data fields of the object with which they are associated (objects have a notion of "this" or "self").
>
> [Wikipedia](https://en.wikipedia.org/wiki/Object-oriented_programming)

The attributes in the mainstream understanding of OOP are usually treated as a data, that an object possesses and encapsulates. Some *state*, that object holds and protects. At the same time, the state placed inside the objects attributes causes problems, for which OOP is often criticized. Like temporal coupling, non-determinism and increased complexity.

On the other hand, in Elegant interpretation of OOP, instead of representing a mutable state of an object, attributes represent certain *identity*, by means of which certain mutable state can be resolved. Mutable state here can have different forms: it can be represented by a file on file system, a table row in some database, a mutable structure, like `HashMap` or `ArrayList`... But *the same identity should always lead to the same state*.

Consider an example:

```java
class Counter {
    private static final Map<String, Integer> STATE = new HashMap<>();
    
    private final String identity;

    public Counter(String identity) {
        this.identity = identity;
    }
    
    public final Integer next() {
        return STATE.compute(identity, (key, value) -> {
            if(Objects.isNull(value)) {
                return 0;
            } else {
                return value++;
            }
        });
    }
}
```

Here, if we instantiate two `Counter` instances with the same `identity` value, we'll get two instances of object which share the same state:

```java
Counter a = new Counter("A");
a.next(); // 0

Counter b = new Counter("A");
b.next(); // 1
a.next(); // 2

Counter c = new Counter("C");
c.next(); // 0
```

What's curious about all this, is that it doesn't matter anymore which class instance we have at hands: `a` or `b`. Until we know the identity of `Counter`, we can always reproduce the counter object from scratch anywhere in the program. And by calling `next` on both instances, we will trigger *exactly* the same set of instructions, access the same state and produce the same side effects on it.

It's time to bring the definition of equivalence:

> Lets call two class instances equivalent, if they have exactly the same identity, by which its state and behavior are resolved. 

In example above, instance `a` is equivalent to `b`, but not equivalent to `c`.

Besides, terms *behavior*, *state* and *identity* I borrowed from [here](https://www.yegor256.com/2014/12/09/immutable-object-state-and-behavior.html#identity-state-and-behavior).

## What makes two class instances equivalent?

From the definition it is obvious that in order to say whether two instances are equivalent, we must compare their identity. Lets consider the `Fraction` example, which I often use in many of my posts, one more time:

```java
interface Fraction {
    int numerator();
    int denominator();
}

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

`FracStatic` is the simplest case: it has identity consisting of two integers, it has no state, and its behavior is rather trivial. It is obvious that two `FracStatic` instances will be equivalent if they have the same values for `numerator` and `denominator` attributes.

But it is not always that simple. In languages like Java we have plenty of objects that just don't declare their identity by attributes. For example: Java structures from `java.util`. You can't instantiate two `ArrayList` instances that would share the same array under the hood. Each of the two will be unique and independent. It is neither good, nor bad, it just makes things a bit more complicated:

```java
class GuestList {
    private final HashSet<String> guests;

    public GuestList(HashSet<String> guests) {
        this.guests = guests;
    }

    public final void invite(String guest) {
        guests.add(guest);
    }

    public final boolean isInvited(String person) {
        return guests.contains(person);
    }
}

GuestList a = new GuestList(new HashSet());
GuestList b = new GuestList(new HashSet());
```

Objects `a` and `b` here are not equivalent, because their identity (`guests` attribute) points to the different *state* (located in different `HashSet` instances). If they were equivalent, the program below would output `true`:

```java
a.invite("skapral");
System.out.println(b.isInvited("skapral"));
```

At the same time, we can make these two instances of `a` and `b` equivalent by providing the same `HashSet` instance to them:

```java
HashSet memory = new HashSet();
GuestList a = new GuestList(memory);
GuestList b = new GuestList(memory);
```

What makes `GuestList` and `HashSet` classes different? Why the instances of the former can be equivalent and the instances of the latter cannot? Two things actually:

- Attributes of `GuestList` are all final. This eliminates all local side effects that do certain object instance unique and irreplaceable.
- Constructor of `GuestList` has no logic inside. This guarantees that if we make two invocations of one constructor with the same set of arguments, it will result in creation of two objects with the same values of attributes.

It all gives us an important conclusion:

> Equivalence term is applicable to instances of only those classes, constructors of which are logic free and attributes of which are final.


Taking into account all the examples and conclusions we made above, we can make the second definition of equivalence:

> Two instances are equivalent, if they are of the same base type and each of their attributes refer to either the same class instance, or a pair of equivalent ones.

## Equivalence and subtyping

The part of definition above, saying about "base type", may sound ambigous here. Yet it is not mistake. I intentionally have formulated it this way. It is because instances can still be equivalent even if they are instantiated from the different classes. Consider an example:

```java
interface Fraction {
    int numerator();
    int denominator();
}

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

class FracOneHalf extends FracStatic {
    public FracOneHalf() {
        super(1, 2);
    }
}

new FracStatic(1, 2) == new FracOneHalf();
```

This example was taken from the chapter about [aliases](005_implementation_inheritance_paranoia.html#aliases). It demonstrates, how an instance of the alias-subtype can be equivalent to the instance of the base class.

## Equivalence and composition

Second part of equivalence definition says that "Instances are equivalent if their attributes refer to either the same class instance, or a pair of equivalent ones". Lets look how the second part of definition works in practice. Consider additional implementation of `Fraction`:

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

Now, check these instances:

```java
Fraction a = new FracSum(new FracStatic(1, 2), new FracStatic(1, 2));
Fraction b = new FracSum(new FracStatic(1, 2), new FracOneHalf());
Fraction c = new FracSum(new FracOneHalf(), new FracOneHalf());

a == b == c;
```

Attributes of `a`, `b` and `c` refer to different, yet equivalent instances of `Fraction`. Taking into account that `a`, `b` and `c` belong to the same base type `FracSum`, we can claim that they are equivalent.
 
## Instead of conclusion

If we sum up the facts that constructors of elegant objects contain no logic, the attributes are final, `instanceof`s and casts are under [taboo](https://www.yegor256.com/2015/04/02/class-casting-is-anti-pattern.html), we will realise that we don't need these objects to be allocated in memory more then once. Each pair of equivalent objects, allocated in some program, we can always replace to the one, and vice versa:

```java
Fraction sum1 = new FracSum(new FracStatic(1, 3), new FracStatic(1, 3));

Fraction arg = new FracStatic(1, 3);
Fraction sum2 = new FracSum(arg, arg);

sum1 == sum2;
```

It means an awesome fact: constructors of truly elegant classes are actually the [*pure functions*](https://en.wikipedia.org/wiki/Pure_function), with all the benefits of purity. And it doesn't matter anymore that technically, `new` keyword allocates us separate equivalent class instances. Semantically, it will just bring us the access to one object.

That does make difference. But it's another story.

