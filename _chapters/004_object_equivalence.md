---
layout: post
title: Objects equality is myth
description: Do not ever consider two objects equal 
date: 2018-10-15T00:00:00+03:00
---

I always thought that presence of `equals` and `hashCode` in `Object` Java class is deep mistake. Not every object in 
Java is designed to be a key for some hash map or a subject for comparisons. Yet these two nasty methods were declared
in the base class, and we must deal with them somehow.

The topic of objects equality was touched by Yegor in this 
[post](https://www.yegor256.com/2017/07/11/how-to-redesign-equals.html). Yegor provided good arguments why designing 
`equals` is usually painful. Indeed - the contract of method `equals` is introduced in such way, that implementing it 
is impossible without nasty hacks like 
[typecasting and `instanceof` reasoning](https://www.yegor256.com/2015/04/02/class-casting-is-anti-pattern.html).

Yet the solution he proposed sounds not convincing to me. It was a good try - to outline comparison capability to a 
separate contract, but implementation looks like a hack. Producing two arrays just to compare them sounds 
unreasonably cumbersome and heavy from performance point of view.

It was not the only attempt to write `equals` and keep encapsulation intact. [Kirill](https://github.com/g4s8) in his
blog [post](https://g4s8.github.io/equals/) proposes to solve this problem by writing decorators with equality 
capabilities. Again - good attempt, good problem definition, but not convincing implementation. Because of two reasons:

- Since object is good when it encapsulates internals, capabilities provided by the object's interface may be 
just not enough to make any sort of adequate comparison. In other words - how to compare in decorator two objects with 
single method returning `void`?

- Since `equals` and `hashCode` methods are widely used inside different sorts of hash-based structures (like 
`HashMap`), using such decorators as hash keys may have undesired drawbacks. Not every interface method is defined with 
same consistency considerations as `equals` method, and writing equality logic based on such methods may easily lead to 
inconsistent and potentially broken `equals`. Using such decorator as key for `HashMap` may lead to memory 
leaks, which are hard to localize.

I think that the problem with objects equality is much deeper then just implementing `equals` method in sane manner. In 
this post, I will describe my philosophy of comparing Elegant Objects. But beforehand, let me start with a question.

## What actually we compare?
 
In attempt to compare *objects*, I see a deep contradiction.

From one side, comparison semantics may vary depending 
on the business needs. Assuming two `User` entities, we can have an intention to compare them by name, passport 
identity, or even both. 

From the other side, objects must strive to seal their internals from outside intervention. It is called encapsulation. 
Having reference on `User` object, there is no guarantee it will provide you any information 
about itself, because this information may be a subject for encapsulation. You won't get any information about 
passport ID from a user declared like that:

```java
interface User {
    String name();
}
```

Implementations of such user may have some passport ID inside, but not for you and your equality logic.

Besides, even if you decided for yourself that comparing two `User`'s by name would be enough for you, think twice, 
because what you'll get may contradict to what you expect. Consider these two `User` implementations:

```java
class GithubUser implements User {
    private final String githubLogin;
    
    public GithubUser(String githubLogin) {
        this.githubLogin = githubLogin;
    }
    
    public final String name() {
        // some logic to obtain user's name from Github API
    }
}

class TwitterUser implements User {
    private final String twitterLogin;
    
    public TwitterUser(String twitterLogin) {
        this.twitterLogin = twitterLogin;
    }
    
    public String name() {
        // some logic to obtain user's name from Twitter API
    }
}
```

Now assume that you have two references on `User` objects and you are to implement some equality logic for them. 
Would you consider them equal if they have same name, but one of them is of type `GithubUser` and the other is 
`TwitterUser`?

From encapsulation and polymorphism point of view, there is no dilemma - these two objects will be equal by name, and 
you shouldn't bother yourself with the fact that they are of different types. If you disagree with that, 
encapsulation and polymorphism become your enemies - the only option left for you is to refuse from them and reason 
about equality of two `User`'s using `instanceof`.

After several probes and mistakes I came to conclusion that intention to write equality logic for *objects* is 
wrong intention. It is okay to compare *data* (like names and passport IDs). It is fine to compare *data 
structures*, like [DTOs](https://www.yegor256.com/2016/07/06/data-transfer-object.html). For objects, it is impossible
to write equality logic in clean manner, because *objects are not data*.

Once you found yourself in situation when 
you need to write a logic for comparing two objects, ask yourself: isn't it the data you are actually trying to 
compare? What data is it? Isn't it by chance some internals of the object you are to compare? And if you need to 
break into object internals, maybe something is wrong with your object's design?

Having two references on `User`'s from example above, you have the right to compare them only by name, since it is the 
only thing they can tell you about theirselves. Other details schould be out of your concern. If it doesn't suit your needs, 
probably you need references to other two objects. `Passport`'s, for example.

For the same reason, don't consider your objects as `HashMap` keys. Hash keys, by definition, are a typical piece of 
data. Objects are not data.

If we treat objects like 
[living creatures](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html#1-he-exists-in-real-life), 
any attempt to tell that two of them are equal is attempt to
[discriminate](https://www.yegor256.com/2017/07/04/sexism.html) them. Each living creature in the world is unique.

## Objects equivalence

Despite the fact that objects are not data, and are not the subject for comparisons, there is actually one reliable way
to compare them. It is based on the following statement from "Elegant Objects" book:

> Encapsulated objects, all together, are also known as the "state" or "identity" of the object. For example:
>
>```java
>class Cash {
>    private Integer digits;
>    private Integer cents;
>    private String currency;
>}
>```
> Here, we encapsulate three objects. All three of them together identify objects of class `Cash`, which means that 
any two objects encapsulating the same dollars, cents, and currency are equal to each other.
>
> ["Elegant Objects"](https://www.amazon.com/Elegant-Objects-1-Yegor-Bugayenko/dp/1519166915/ref=sr_1_1?ie=UTF8&qid=1542212017&sr=8-1&keywords=elegant+objects), vol 1, chapter 2.1

Lets introduce the term "object equivalence". We will call two objects equivalent, if they are instances of the 
same class, and for each method called with the same set of attributes they produce exactly the same 
actions and side effects. In practice, two equivalent objects are not only equal - they are *same*. You can always 
replace two of them to one and semantics of your program won't change.

Simplest example of two equivalent objects is two [fraction](001_checked_exceptions.md) objects in example below:
```java
new FracFromString("1/2").equals(
    new FracFromString("1/2")
); // == true
```

More complex example of equivalence we already saw [here](002_never_make_class_final.md):

```java
new TeeInputFromUrlToFile(
    "http://example.com/somefile",
    new File("/tmp/tempFile")
).equals(
    new TeeInput(
        new InputFromUri(
            "http://example.com/somefile"
        ),
        new OutputFromFile(
            new File("/tmp/tempFile")
        )
    )
); // == true
```

Formally, we can safely call two objects equivalent if:

- they are instance of the same base class (`FracFromFile` in first case, `TeeInput` in second)
- all their fields are equal (this came from the definition of object's identity and equality from the quote I 
mentioned above)

Being based on identity (which is supposed to 
be [final](https://www.yegor256.com/2014/06/09/objects-should-be-immutable.html#avoiding-identity-mutability)), 
equivalence logic is consistent enough to be a good candidate for putting inside `equals` method of 
every *object*.

Note however that objects equivalence is not replacement for data equality. For example, you won't find equivalence 
convenient for comparing two fraction objects:

```java
new FracFromString("1/2").equals(
    new FracStatic(1, 2)
); // == false, because of different fields and base class type
```

In practice, equivalence logic is convenient only in a limited number of low-level cases, like 
caching, runtime analisys, and optimizations. Sometimes it can be useful for exact-matching expected and actual results 
in testing. In other words, equivalence is not for everyday usage.

Yet, since objects are not subject for comparisons, equivalence is a good at least for stubbing this nasty `equals` 
method.

## OO-Atom for generating equivalence logic

Equivalence logic is rather hard to write from scratch (a subject for a future post). For reasoning about 
two object's equivalence in `equals`, and for keeping `equals` consistent and correct, the class of these objects 
must meet certain [requirements](https://github.com/pragmatic-objects/oo-atom/blob/master/docs/ATOM_SPECIFICATION.md).

That's why in my [OO-Atom](https://github.com/pragmatic-objects/oo-atom) tool I introduced capability of generating 
equivalence logic in `equals` and `hashCode` methods for all elegantly-designed classes in project. For each class, 
it checks all preconditions, and if they are met, automatically generates correct implementations of `equals` and 
`hashCode` for them, taking into account all possible pitfalls.

No need to pollute the code of your objects with typecasts and `instanceof`'s anymore. The tool will make all dirty 
work for you!
