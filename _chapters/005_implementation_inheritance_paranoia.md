---
layout: post
title: Implementation inheritance paranoia
description: Inheritance iS not evil if done right.
date: 2019-01-30T00:00:00+03:00
---

Position of Yegor Bugayenko and "Elegant Objects" towards implementation inheritance is known for quite a long time
and clearly outlined in this [post](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html).
Inheritance was named "procedural technique for code reuse" and banished in favor of what is called "subtyping".
It causes a dangerous tendency in EO community, directed to eliminating implementation
inheritance as a kind at all costs.

I am not in favor of this "all classes must be final or abstract" mantra, and already wrote about it, but
my [post](002_never_make_class_final.md) got quite controversial feedback. Recent [issue](https://github.com/teamed/qulice/issues/920),
accepted in [Qulice](https://github.com/teamed/qulice) static analysis toolset was last drop.

Guys, I understand the negative side 
of implementation inheritance, but this fear towards `extends` keyword and non-final classes feels unhealthy. Let's stop 
and think together what we actually hate?

## Why so much fear and hatred?

Before analysing things that we hate, let's analyse things that we love. What we love?

> Deriving a characteristic from another object is a great idea, 
> and it’s called subtyping. It perfectly fits into OOP 
> and actually enables polymorphism
>
> [Inheritance is procedural technique for code reuse](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html)

Subtyping, indeed! Everyone loves subtyping. But what is subtyping in OOP if not inheritance? The post gives us one example:

```java
interface Manuscript {
  void print(Console console);
}
interface Article extends Manuscript {
  void submit(Conference cnf);
}
```

Well, actually this is not subtyping yet --- it is called interface inheritance. But really interesting question is: 
if one interface extends another, does it really mean that subinterface will automatically become a subtype of the interface
it is derived from?

Lets check another example:

```java
// A set of some items
interface SetOfItems<T> extends Iterable<T> {
}

// A set of at least one item
interface AtLeastOneItem<T> extends SetOfItems<T> {
}

// Either empty set, or a set of one item
interface AtMostOneItem<T> extends AtLeastOneItem<T> {
}

void printFirstItem(AtLeastOneItem<T> item) {
    // Since there is at least one item, we can omit checking on empty set, can't we?
    return item.iterator().next();
    // Yet someone may pass us instance of empty AtMostOneItem instance - oh, shi...
}
```

Can we really call `AtMostOneItem` a subtype of `AtLeastOneItem`? Of course no, because it contradicts one little but important principle...

## Liskov substitution principle

Liskov substitution principle says that:

> if S is a subtype of T, then objects of type T may be replaced with objects of type S 
> (i.e. an object of type T may be substituted with any object of a subtype S) without altering any of the 
> desirable properties of the program (correctness, task performed, etc.)
> 
> [Wikipedia](https://en.wikipedia.org/wiki/Liskov_substitution_principle)

In our example, there is a program named `printOneItem`, which becomes incorrect if we pass the instances of `AtLeastOneItem` instead of
`AtMostOneItem`, originally defined in signature. It is direct contradiction of the principle, so we cannot call `AtMostOneItem` a subtype, despite
the fact that it implements `AtMostOneItem`. Yet Java doesn't care --- the code will compile and run.

Is it really subtyping we love?

No. The interface type is not just a bunch of abstract methods --- interfaces have *meaning*. And writing `extends` in interface declaration
is not enough for making it a subtype, because nobody will guarantee that the meaning of the base interface is truly derived. Only developer can guarantee that.

> The third letter is for the Liskov Substitution Principle, which was introduced by Barbara Liskov in 1987. This one is the most innocent part in the SOLID pentad.
>
> It is also known as subtyping and is the foundational component of any object-oriented language. Why do we need to call it a principle and “follow” it?
> Is it at all possible to create any object-oriented software without subtyping? If this one is a principle, let’s add “variables” and “method calling” here too.
>
> [SOLID Is OOP for Dummies](https://www.yegor256.com/2017/03/28/solid.html#l)

That's exactly the reason, why we need LSP as a principle, Yegor. Because no matter how we make subclasses or subinterfaces --- by `extends`, `implements`, 
[`decorates`](https://www.yegor256.com/2017/01/31/decorating-envelopes.html) or [`trust`](https://www.yegor256.com/2016/12/20/can-objects-be-friends.html) --- 
they will truly be subtypes if and only if they literally follow LSP. And nobody will follow LSP for us, developers.

## Back to inheritance

The problem with implementation inheritance is exactly the same as with interface inheritance. If we haven't ensured that our subclasses (subinterfaces) are truly
the subtypes of the classes (interfaces) they are derived from, the whole program based on them will fall apart. We just won't be able to reuse them smoothly.

The problem is common, yet we embrace interface inheritance and fear extending classes. Why such discrimination? If we can safely inherit neither the interfaces, nor 
their implementations, why haven't we restricted `extends` keyword in Qulice for interfaces as well?

Honestly speaking, there is one reason. In typical mainstream OOP languages, like Java, C++ or C#, inheritance capabilities are too wide.
There are plenty of ways to break subtyping in class hierarchies:
- We can declare public or protected attributes in base class
- We can mutate protected fields
- We can override methods in child classes
- We can add new attributes and methods in children

Indeed, with such capabilities, implementation inheritance looks like a procedural way of code reuse. The base class is broken to public/protected/private
parts, which are reused and replaced by subclasses independently. It is desperately hard to ensure in such curcumstances that the whole hierarchy follows LSP.

Is it bad? Yes, it is. Does it mean that we should restrict non-final classes? No it doesn't, because the root cause of the problem is not in the fact that 
classes are open. The root cause is too permissive rules of class inheritance, which makes it hard to control subtyping correctness.
So, why not fighting the root cause instead?

## Aliases

In Java, for example, I outlined a set of rules which helps a lot to keep LSP stable for the whole class hierarchy, no matter how deep is it. The rules are simple:

- No protected stuff
- Child class should never override any methods of base class
- Child class should never introduce any new attributes and methods
- The only thing child class may introduce are [secondary constructors](https://www.yegor256.com/2015/05/28/one-primary-constructor.html)

Of course, in order to apply these rules, all classes should be [open for extensions](002_never_make_class_final.md).

Child classes, which follow these rules, I call *aliases*. Here are some examples:

```
interface Fraction {
    int numerator();
    int denominator();
}

// base class
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

// an alias
class FracOneHalf extends FracStatic {
    public FracOneHalf() {
        super(1, 2);
    }
}


// another alias
class FracOneThird extends FracStatic {
    public FracOneHalf() {
        super(1, 3);
    }
}
```

Aliases have interesting capability --- they *never* break Liskov Substitution principle. They just can't break it. It's just impossible without violating aliases' rules.
They are always subtypes of the base class. They are always safe.

I believe that it is possible to outline a similar set of rules for every language where implementation inheritance exists, and enforce them by means of static analysis. 
Important thing to remember is that the class must be derived as a whole, and inheritance is applicable only for true subtypes.

## To sum up

It's not inheritance that makes subtypes for us, it's we, developers, who make subtypes by means of inheritance. Broken subtyping is our fault.
And implementation inheritance is the instrument for subtyping *as well as* interface inheritance. Stop this "no implementation inheritance" paranoia.
It sounds like blaming hammer for broken fingers.

