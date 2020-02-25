---
layout: post
title: "Six traits of high-quality abstractions"
description: Traits, that will make your abstractions truly helpful.
date: 2020-02-25T00:00:00+03:00
---

[Dependency inversion principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle), the last and, in my opinion, the most important letter in SOLID abbreviation, says: "abstractions should never depend on details. Instead, it's details which must depend on abstractions". Inverse your dependencies. Keep coupling loose. Since interfaces in Java are the means for designing abstractions, these principle is addressed to them as well. At the same time, all these principles sound a bit vague and... abstract.

In this post I've collected some concrete traits which, in my opinion, each abstraction should always have. You may say that they are well-known and too obvious to discuss, but in practice I see that they are almost always ignored or misinterpreted.

## Note 

In this blogpost, I will use the terms "interface" and "abstraction" as synonyms. Technically, they are not the same thing, but practically, as I already said, in languages like Java, interfaces are the best mean for declaring abstractions.

The traits below can be actual even for the paradigms and languages that don't have interfaces as a kind. Your [units of reuse](013_mental_maintainability_model.html) will inevitably have some public contract, by which they will bound to each other. Traits below are actual to all kinds and ways of defining such public contracts.

### Trait #1: Interface should stay stable, no matter what

No matter how business is changed around your application, you should strive to make your abstractions stable. Stability is the primary and the only reason to abstract anything, because only stable things are safe to depend on. Therefore, if you are forced to change your interfaces too often, it's a good indicator to stop for a while and think about possible refactoring.

In my blog I often use a `Fraction` interface for demonstrating some of the ideas. Provided that the domain of some hypothetical application is working with simple math fractions, `Fraction` interface could be an example of a good stable  abstraction. Being bound to the stable definition of a fraction, saying that fraction is a thing with numerator and denominator, it ls less likely to be changed, whatever requirement the client of this hypothetical application will bring to us:

```java
interface Fraction {
    int numerator();
    int denominator();
}
```

What makes `Fraction` interface stable? The absence of implementation details, and reflection of a business demands, [of course](006_design_core_principles.html). Fraction definition doesn't assume anything about the inner representation of its counterparts. It doesn't assume anything on how the fraction was obtained or calculated, it just states that here is a fraction, which obligatory has the numerator and denominator. Period.

If you noticed that your interfaces are changed on each third feature request, it is a clear sign that you picked up whong abstraction. Do some retrospective and try to find an answer --- what is stable there, and what is not. Leave stable stuff in the interface and move volatile parts to its implementations.

### Trait #2: Truly good interface has infinite number of potentially useful implementations

`Fraction` interface can be implemented in infinite number of ways:

- A trivial implementation, a fraction with fixed numerator and denominator.
- A fraction-result of a various math operations with fractions: `FractionSum`, `FractionSubstract`, etc.
- A fraction obtained from various sources: from a file (`FractionFromFile`), from a string (`FractionFromString`), [SQL-speaking](https://www.yegor256.com/2014/12/01/orm-offensive-anti-pattern.html#sql-speaking-objects) fraction, etc

The fact that the `Fraction` abstraction is tiered apart from any irrelevant technical details enables an ability to implement any technical details later, on demand. At the same time, client code, which operates on fractions, won't be impacted, whatever implementation we choose. This enables flexibility in taking decisions, and wakes following [Open-closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle) natural and straight-forward.

### Trait #3: Liskov substitution principle is obligatory requirement for all interface's implementations

Remember, that all those infinite interface implementations, existing or imaginary, *must* follow [Liskov substitution principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle). Don't even consider a class as a potential implementation of some interface if it doesn't follow LSP towards it. All [troubles with inheritance](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html) are actually a result of [people violating](005_implementation_inheritance_paranoia.html) Liskov substitution principle when working with subtyping instruments. So never forget it.

Remember also that interface is not just a mere bunch of methods. It has meaning, semantics. For example, given the `Fraction` interface, mentioned above, making one of its implementations to return zero on calling `denominator()` may be considered as LSP violation, despite the fact that Java type system allows that. Because for [rational numbers](https://en.wikipedia.org/wiki/Rational_number), dividing by zero makes no sense, and clients of `Fraction` are in their right to rely on this fact. Providing zero-denominator fraction to the clients will eventually break them, often in a hard way.

### Trait #4: There should be particular client with some demand behind each interface

When you seek for abstractions, it's good idea to ask in advance: who will be the clients of it? How will it be used? Why do we need it? A client can be real (a user of your library or application, a customer or stakeholder of the product you design), or fictional (some class or component, which will depend on your abstraction). Former is more preferrable than latter.

The reason why it is important is that it is very often the client who implicitly defines how the interface will look like.

For example: lets imagine the typical `User` interface. Which methods is it supposed to have? Depends on who will use it and how. If we should show some user's summary, then we can (theoretically) define it like this:

```java
interface User {
    String summary();
}
```

...or [this](https://www.yegor256.com/2016/04/05/printers-instead-of-getters.html):

```java
interface User {
    void printOut(Media media);
}
```

If we should deliver a mail to some user, then the `User` can be defined like this (if the mail is electronic):

```java
interface User {
    EMail address();
}
```

...or this (if it is about postal delivery):

```java
interface User {
    String zip();
    String postalAddress();
    String name();
}
```

Sometimes, there could be many clients per one thing. For example, we may be required to show user's summary and deliver mails to them (including both postal and electronic) in one application. In such case, remember about SOLID. In particularly, about the [interface segregation](https://en.wikipedia.org/wiki/Interface_segregation_principle) and [single responsibility](https://en.wikipedia.org/wiki/Single_responsibility_principle) principles. True client of the abstraction uses its capabilities at maximum. A client, which is bound to too many irrelevant information is [coupled](https://en.wikipedia.org/wiki/Coupling_(computer_programming)) client, and coupled code is always a source of troubles with maintainability.

That's why a single `User` interface may be not the best option for you, and other abstractions might suit your needs better:

```java
interface UserSummary {
    String asString();
}

interface EMail {
    String address();
}

interface PostalAddress {
    String zip();
    String userName();
    String addressLine();
}
```

### Trait #5: Interfaces should not be bound to data structures

Here, I am talking about data-like interfaces and data structures like DTOs. For the problem of data-like "abstractions" I dedicated [a separate blogpost](010_objects_and_data.html). In short --- if your application operates with some data model, binding abstractions to the data structures from that model is very risky and dangerous idea. Data models of a typical enterprize applications are almost never stable. Today your users are a tuple of `[id, login, email]`. Tomorrow the business will force you to add `name`, `surname`, `address`, `zip`, `authentication_roles` and many other stuff. While your database can easily handle these changes, your `UserDTO` class will turn all code that is coupled to it to a uncontrollable mess.


### Trait #6: Naming your interfaces with the names of design patterns is deep mistake

In "Elegant Objects" this rule is formulated as ["Don't create objects that ends with -ER"](https://www.yegor256.com/2015/03/09/objects-end-with-er.html). This rule is a good recommendation, but it has one weakness though: some names can end with `-ER` and be a part of a business domain. Examples are `Reader` (if it is about a client of a library), `Writer` (author of books), `Printer` and `Scanner` (typical office inventory), `Trigger` and `Emitter` (a button and a light bulb), `Cooler`, `Header`, `Timer`, plenty of them. "Elegant Objects" [proposes](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html#6-his-name-is-not-a-job-title) seeking for non-ER alternatives, but c'mon: naming is one of the most [difficult things](https://habr.com/ru/post/437122/) in Computer Science, let's don't make it even harder!

So, I'd rephrase the -ER rule as:

> Never name your objects with the names of [software design patterns](https://en.wikipedia.org/wiki/Software_design_pattern)

Why? Simple. Typical software design pattern usually solves some general problems related to code organization, but they all are too general to take into account the business domain. And for abstractions existense, business domain is crucial! When thinking with patterns first, it is super-easy to forget about reality and start solving imaginary problems. Concequences of this are known under the term "overdesign". It starts with innocently looking `UserDAO`'s, `ItemController`'s, and `ClientService`'s, that collect inside themselves the procedures directly or indirectly related to users, items, clients... Later, when it eventually ends up with cryptic `AbstractGenericControllerBuilderBean`'s, it's too late to fix anything.

Clients and customers choose our applications not because they have DAOs, Services, Builders, Listeners and DTOs. They choose our applications only when our applications solve their problems. Real problems, not imaginary. Since abstractions are the reflection of the application's purpose, or business domain, patterns are odd there.

## Sum up

Make all interfaces of your application like described above, put your eforts to support these traits, and you'll notice that maintenance will become much easier. Reaching this state is not trivial, especially on early stage of development, when there is typically not enough knowledge about the business domain. The knowledge, crucial for reasoning about what is stable and what is not.

But striving towards the ideal worth the efforts.


