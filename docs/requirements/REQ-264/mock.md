# REQ-264 mock: free query balance

## Flow

```
  Signed-in user                         My Guide API
  --------------                         ------------
       |   request: my free-query balance     |
       |------------------------------------->|
       |                                      |-- signed in? --no--> standard
       |                                      |                      unauthenticated
       |                                      |                      response (no balance)
       |                                      | yes
       |                                      |-- allowance = stored setting (default 2)
       |                                      |-- used      = completed action plans
       |                                      |               since sign-up (guests excluded)
       |                                      |-- remaining = max(allowance - used, 0)
       |   { remaining, allowance, used }     |
       |<-------------------------------------|
```

## What uses up a free query

```
  query asked (signed in)
        |
        v
  ends with a completed action plan? --no--> used unchanged
        |
       yes
        v
  used + 1   (remaining shown never drops below 0)

  query asked as guest ----------------------> never counted
```

## Example balances (default allowance = 2)

```
  +---------------------------+-----------+-----------+------+
  | Situation                 | remaining | allowance | used |
  +---------------------------+-----------+-----------+------+
  | New or pre-existing user  |     2     |     2     |  0   |
  | After 1 completed plan    |     1     |     2     |  1   |
  | After 2 completed plans   |     0     |     2     |  2   |
  +---------------------------+-----------+-----------+------+
```
