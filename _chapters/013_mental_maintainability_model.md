---
layout: post
title: "Mental maintainability model"
description: The one and the only way to judge about software maintainability
date: 2019-11-10T00:00:00+03:00
---
Several months ago, I outlined [my personal minimal self-sufficient set of principles](006_design_core_principles.html) for keeping software design maintainable at all times. The principles were the following:

> 1. Each self-sufficient reusable component of some software should be either abstract or concrete.
> 2. Abstract components are good at defining a purpose of application and intentions of its parts, while concrete components are good for implementing end-user software requirements.
> 3. Abstract components should be stable, while concrete components should be easy to change.
> 4. Abstract components should never depend on concrete components.
>
> [The core principles of software design](006_design_core_principles.md)

Yet the story feels unfinished without the explaination of how I got these principles, so I decided to dedicate this post to fill this gap and elaborate on what I mean when I say "true maintainability".

## Introduction

Modern programming is impossible without splitting the source code to units --- self-sufficient reusable pieces of code. Units may be represented by many things: in object oriented programming, units are usually the classes and interfaces, in functional programming --- functions, in procedural programming --- procedures. If we look on higher level, there will be units too: in Java they are the Jar files. In [OSGi](https://www.osgi.org/) they are the OSGi modules. Even [microservices](https://microservices.io/) we can count for "units". Why not?

What was the main purpose for the units to be introduced in the first place? Why do we need the code be broken into pieces? I believe there is the only correct answer for this: reuse. We need units in order to reuse the pieces of code.

When it comes to units, there is one good and one bad news. Good news is that units, while being reused in various places of the system, allow us to significantly reduce amount of boilerplate and duplicated code. Bad news is that while being reused, units bring some nasty effect called coupling. And with tight coupling it becomes really hard to reuse the units.

I'd say coupling is zero-day vulnerability of separating code to units. No matter how you split and reuse your code, no matter what paradigm you follow, language you use, the story will always be the same. With reusability inevitably comes the coupling.

Why coupling is bad? Well, usually the reason we strive to keep software maintainable is to meet everchanging business requirements. And the business is known to be very volatile. Every day it comes to us with new requirements, and these new requirements challenge our code on daily basis. In good days cost of feature implementation is about making simple one-liner. In bad days, feature impacts huge amount of code, costs a lot, causes great risk of regressions and burns people's nerves. When bad days prevail over good ones, we usually say that software is not maintainable enough, and start thinking about refactoring. Needless to say that coupling takes not the least role in making our life worse.

So. Taking all of this into account, I'd formulate the following definition of maintainable design:

> Maintainable software design is splitting the software code to units in such way, that coupling from their reuse will cause as less obstacles for maintaining business needs of software as possible.

Below in the post, I'll stick to this definition. If you disagree with it, lets discuss it in comments.

## Main sequence

Once upon a time, Robert Martin outlined an interesting model in his "Clean Architecture" book, called "main sequence". Originally, Uncle Bob described it in context of packages, consisting of classes, but I believe it works for any kind of reusable code, and can be generalized for anything. I highly recommend to read about main sequence in the book. In this post, I'll provide my generalized version of the model.

### Dependencies

First of all, we need to classify all the dependencies to two types:

- *Fan-in dependencies* (afferent coupling) --- given unit `Y`, a set of other units which depend on `Y`. The notable thing about this kind is that when business hits unit `Y`, it's fan-in dependencies will be impacted as well.

- *Fan-out dependencies* (efferent coupling) --- given unit `Y`, a set of other units which `Y` depends on. The notable thing about this kind is that when business hits one of the unit `Y`'s dependencies, unit `Y` will be impacted as well.

### Instability

*Instability* is a degree of how much the units are volatile and easy to change. It is counted as:

<img src="https://latex.codecogs.com/gif.latex?Instability = \frac{N_{fan-out}}{N_{fan-out}+N_{fan-in}}" border="0"/> 

Stable units (instability is close to 0) are hard to change, because any attempt to change them will cause 
impact on all its fan-in dependencies. At the same time, since there are not much of fan-out dependencies, there is 
less risk of impacting the unit from changes wherever they occur in application.

Volatile units (instability is close to 1) are easy to change - the impact from changing them has no place to spread, since there are no fan-in dependencies. But at the same time, such units tend to change very often, because they have lots of fan-out dependencies, from which the the impact of changes can come.

### Abstractness
*Abstractness* is relation of abstract parts of the component to the whole. *Abstract* here stands for some non-executable high-level declaration, unbound from all implementation details. It is counted as:

<img src="https://latex.codecogs.com/gif.latex?Abstractness = \frac{N_{abstract}}{N_{abstract}+N_{implemented}}" 
border="0"/>

Abstract units (abstractness is close to 1) contain no executable code and are free from all low-level implementation details. Usually, they are actively being reused by other units of application. Typical representatives are interfaces.

Implementation units (abstractness is close to 0), on the contrary, are full of executable code and are tightly bound to implementation details. Usually, they are actively reusing other units of application. Typycal representatives are classes.

## Zones

Now, if we take all units of some application and estimate abstractness and instability for them,
there will be four groups, or four zones

### Stable abstractions

These units are the best candidates for your application's high-level architecture. Use them to define the purpose of your application, and keep them as independent from low-level details as possible. Note that since they are stable, you should be concerned when you realise that the business demands you to change them. Good news is that these units are highly and safely reusable.

### Volatile implementations

These units are the best place for low level concretics, and implementing end-user requirements. End-user requirements are well-known to be highly unstable, that's why in order to meet business challenges, volatile implementation units must remain volatile. Which means that you should never reuse them in other units. Good news though is that these units are really easy to change.

### Stable implementations (Zone of pain)

Such components are hard to change, since they are actively used by other units, yet they tend to change, since they are deeply bound to low-level details. These components are in zone of pain, and when software requirements change, these units will make you suffer. Avoid them at all costs.

### Volatile abstractions (Zone of uselessness)

These are some redundant and forgotten units, which are not used by anybody, but for some reason weren't removed. They are in zone of uselessness - they usually won't bring you explicit troubles, but  will pollute your code. It's better to get rid of them.

## How to apply this knowledge

The model above is applicable to any environment or paradigm based on reusable components. To apply it, just answer to yourself on these questions:

1. What is unit in your environment? How your code can be reused?

2. How units in your environment can depend on each other?

3. How can you abstract low level details out in your environment

Then, having the answers in mind, keep your units away from zone of pain.

For OOP and Java, my answers on these questions would be the following:

1. Legit units in Java are classes and interfaces.

2. In Java, there are two kinds of legit dependencies, possible between units. One is referencing (when one Java type uses another Java type in attributes or methods), another is subtyping (when one type extends/implements another, respecting [LSP](https://en.wikipedia.org/wiki/Liskov_substitution_principle)).

3. In Java, there are two ways of abstracting out low level details: by means of interfaces and abstract classes.

This is not the only possible set of answers of course. The answers would be different for different paradigms, languages, approaches and environments. Anyway. Having the answers to these questions, you can estimate abstractness and instability of your units and treat them accordingly.

If you assume that certain class or interface must be reused actively (is stable), it's in your interest to purify it from low-level details, and keep its dependencies to a bare minimum (make an abstraction from it). Making methods abstract and referencing only the interfaces is a good option to do so. Keeping number of imports small is another good strategy.

If you realise that your class depends too much on the other classes, it's in your interest to prohibit its reuse (keep it volatile). Or to think about refactoring it. Note however that the enormous list of dependencies is not yet a trouble per-se. It will become a trouble, but only if you plan to reuse the unit. At the same time, for entry points to your system, like `main` class, or HTTP endpoint controller, having loads of dependencies is usually safe. Because you will doubtly ever have temptation to reuse `main` or controller class across the system.

Keep in mind that your environment can be quite complex. In Java, in addition to classes and interfaces, there could be other self-sufficient pieces of code. Like static methods, that fit very well to the definition of unit (despite the fact that they [don't fit well enough to the OOP paradigm](https://www.yegor256.com/2014/05/05/oop-alternative-to-utility-classes.html)). And speaking about dependencies between units, there is very large number of ways in Java of how one can implicitly couple one unit to the other: [broken LSP](005_implementation_inheritance_paranoia.html), [temporal coupling by means of mutable side effects](https://www.yegor256.com/2014/06/09/objects-should-be-immutable.html#avoiding-temporal-coupling), [NULLs](https://www.yegor256.com/2014/05/13/why-null-is-bad.html), [checked exceptions](001_checked_exceptions.html), [type-based reasoning](https://www.yegor256.com/2015/04/02/class-casting-is-anti-pattern.html)... You name it. They can cause quite inobvious ways of making two units dependant. Tracking instability and abstractness, taking into account all this stuff together, is very hard and error-prone.

That's why in order to keep design under control, it is crucially important to follow the rule...

## Keep It Simple and Stupid

No matter what framework you use. No matter what paradigm you follow. No matter what programming language you use. Your answer on the questions above must be as simple as possible.

If the answer is hard, simplify it. If you are in OOP paradigm --- prohibit static methods, since objects are your true uints, not procedures. If you see that there are NULLs and reflection that can cause parasitic dependencies between units, prohibit them as well. 

Every thing, that doesn't fit to the answer you gave, must be explicitly prohibited. Be pragmatic --- each and every thing you use for the sake of maintainability must follow one and the only purpose. Helping you to keep your units away from zone of pain.

Nothing else matter.

