---
layout: post
title: No DI containers, please
description: Adequate SOLID design doesn't need any DI containers 
date: 2019-04-19T00:00:00+03:00
---

Once ago in this [post](https://www.yegor256.com/2014/10/03/di-containers-are-evil.html), Yegor Bugayenko named DI 
containers the "code polluters". It was quite argueable and contradictory claim. The first time I read it, I 
was not convinced by provided argumentation. However, later I came to the same conclusion. If you want your application 
design to be maintainable, DI containers is the least thing which will help you with that. In best case, it will be 
just useless. In worst case, as we will see, it will even harm your design. In this post, I will provide my set of 
arguments.

## Disclaimer

I will take [Spring Framework](https://spring.io/projects/spring-framework) as an example, 
since it is the most known and popular DI framework in Java ecosystem nowadays,
but each and every conclusion I will make one can interpolate on the other DI containers.
 
And yes, I know that Spring Framework is much more than just a DI container --- it is sort of an integration 
platform nowadays. In this post, I will intentionally omit its capabilities which are not related to
dependency injection.

Since even as DI container Spring provides lots of capabilities for making injections in different ways, I can't 
cover all of them in one post --- it will be too huge. For illustrating my argumentation, I took two most known ways: 
annotation-based injections and Spring XML. Other capabilities of Spring and other DI containers can be mapped on 
the provided argumentation quite easily. If I forget something, don't hesitate to remind me in comments.

## Lets start

First, all DI capabilities of containers can be divided into two groups:

- Internal configuration: when DI container infers information about bean's dependencies from the bean itself, based on 
annotations, types, names and other metainformation stored inside bean. Examples are injections using `@Autowired` 
and `@Inject` annotations.

- External configuration: when information of the bean's dependencies is defined in external configuration file or 
described by means of some DSL, provided by container. Example is Spring XML.

## Thesis 1: Internal configuration is toxic

So, imagine you have some annotated bean:

```java
class BeanA {
    @Autowired BeanB bean;
    
    /// Methods go here
}
```

That's how typically we inject one thing to another. Simple --- `BeanB` injected in `BeanA`. But what exactly is 
`BeanB`? What if it is an interface or abstract class, which has several implementations? Which one will be injected?

```java
abstract class BeanB {}

class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    @Autowired BeanB bean; // BeanB1 or BeanB2? 
    
    /// Methods go here
}
```

Lets [search](https://www.baeldung.com/spring-autowire) for the answer:

> By default, Spring resolves `@Autowired` entries by type.
If more than one beans of the same type are available in the container, the framework will throw a fatal exception 
indicating that more than one bean is available for autowiring.

Nice. So --- how should we solve it? Same source provides us with several hints:

- We can annotate autowired injection with `@Qualifier`, saying which bean to inject there
- Spring can use the injected field name as default qualifier

There are of course many other ways Spring provides to work this problem around, but let's stop on qualifiers. How 
can we fix our injection?

```java
abstract class BeanB {}

@Component("theBean")
class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    @Autowired @Qualifier("theBean") BeanB bean; // BeanB1! 
    
    /// Methods go here
}
```

Now, let's look at the code from design point of view. Lets assume that types `BeanB1` and `BeanB2` are not 
only extending `BeanB`, but are  designed to be the [subtypes](https://en.wikipedia.org/wiki/Liskov_substitution_principle) of it. From Liskov 
Substitution principle definition, it'd mean that `BeanA` instances are equally correct with injected `BeanB1` or 
`BeanB2`.

Yet we hardcoded `BeanB1` to `BeanA`. Not directly --- by qualifier. But still! What if in one 
place of the system we'll need `BeanA` composed with `BeanB1` and in another place---`BeanA` composed with `BeanB2`?
How should I annotate `BeanA` to achieve that? If I had instantiated `BeanA` by myself, I could have easily reused it
in as many places as I need. With all these qualifiers and container in front of me I can't easily reuse `BeanA` 
anymore!

The fact that the dependency-related information is stored inside the bean is actually a huge problem, because it 
causes us to lose SOLID principles one by one. You cannot use [LSP](https://en.wikipedia.org/wiki/Liskov_substitution_principle) on `BeanA` anymore - 
all information about which `BeanB` to inject is stored inside `BeanA`.
You can define the base type of the injected attribute (like in my example) but it won't help you. Spring will either 
implicitly couple it to certain implementation (the one which Spring finds suitable inside its context according to 
resolution strategy), or fail until you couple it by yourself using qualifiers, exact attribute type, name, or other 
means...

Since you are loosing flexibility in substituting subtypes, you have no reason to subtype per-se --- good bye [OCP](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle).
You'll find much easier to make somewhat like this instead:

```java
class BeanA {
    @Autowired BeanB1 bean; // I want BeanB1 here so I will explicitly couple it here
    
    /// Methods go here
}
```
Why having all this hierarchy of `BeanB` if you can't substitute it easily? Let's just wire the beans directly, right?

Deadly wrong! By doing this, you are losing probably the most important principle from maintainability perspective --- 
[DIP](https://en.wikipedia.org/wiki/Dependency_inversion_principle). Bitter truth is that by autowiring beans in the
way above, you make one concrete component (`BeanA`) depend on another (`BeanB1`), while it should have depended on 
abstraction (`BeanB`). 

In the end, the whole solution, built on `@Autowired` dependencies, is usually nothing more than just a parody on 
procedural programming. Beans there are just tightly-coupled ever-growing ever-changing services (storages for 
procedures), with injections as an ugly alternative for C-like `#include` directive.

## Thesis 2: External configuration is useless

So, placing configuration inside beans is evil? Okay, but we have also the alternative --- we can use Spring XML and 
keep our beans clean:

```java
abstract class BeanB {}

class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    private final BeanB bean;
    
    public BeanA(BeanB dependency) {
        this.bean = dependency;
    }
    
    /// Methods go here
}
```

```xml
<beans>
    <bean id="beanB1" class="BeanB1"/>
    <bean id="beanB2" class="BeanB2"/>
    <bean id="beanA1" class="BeanA">
        <constructor-arg ref="beanB1"/>
    </bean>
    <bean id="beanA2" class="BeanA">
        <constructor-arg ref="beanB2"/>
    </bean>
</beans>
```

Our beans are clean from dependency-related information now. Container needs no more reasoning about which dependency
to inject based on what is inside in `BeanA` --- all the information is now defined in cosy external XML configuration.

Yet this XML-based configuration is not very popular nowadays. People in majority prefer more compact 
and nasty annotation-based way we discussed already. And it's hard to blame them for that --- these XML descriptors 
typically grow very huge in very short time, they can be too verbose and hard to understand and maintain.

My question is --- if it is so hard to keep and maintain these huge XML descriptors, what do we really need them for? 
All they describe is just how the objects should be instantiated. How Spring XML is better then just plain Java code?

```java
BeanA beanA1 = new BeanA(
    new BeanB1()
);
BeanA beanA2 = new BeanA(
    new BeanB2()
);
```
   
Collecting a single application from reusable objects is just a question of ordinary object composition --- why we 
need a separate complex framework like DI container with some DSL for such simple 
and straight-forward matter? Why forcing developers to study unintuitive and ambiguous rules DI containers are 
working by, when they can achieve the same by plain Java and object composition, and it will be much easier to read, 
understand, debug and test? I can't get it, honestly.

## Okay, what are the alternatives?

Alternatives to what? DI containers? Well, nothing. No DI containers. Just [healthy object-oriented 
SOLID](006_design_core_principles.html) design would be okay. I said "object-oriented"? Well, funny, but it seems that functional paradigm never 
suffered from such "DI container" [misconcept](https://stackoverflow.com/a/14329487/3223300). Maybe it's time to
clean OOP from it either?

Someone may ask here: "Maybe the concept is okay, but it's implementations that are ugly? Maybe we need to make some 
brand new DI container, or use CDI/Dagger/Guice instead?" I tend to disagree with that. The reason is --- whatever 
implementation we take or imagine in place of `@Autowired` or XML descriptor, it will still need to gather information 
about injections from somewhere --- either from inside or outside the bean. I personally see no third way.
Placing dependency management on some container's shoulders will inevitably lead to repeating the negative aspects 
outlined above.

So, my motto is: adequate software design doesn't need DI containers.
