-- Auto-generated migration from ingestion pipeline
INSERT INTO public.reference_questions (source_competition, year, subject, question_text, has_diagram, source_url, language, source_country, resource_type, learning_track, full_pdf_storage_path)
            VALUES ('Putnam', 2025, 'Mathematics', 'The 86th William Lowell Putnam Mathematical Competition
Saturday, December 6, 2025
A1 Let m0 and n0 be distinct positive integers. For every
positive integer k, define mk and nk to be the relatively
prime positive integers such that
mk
nk
= 2mk−1 + 1
2nk−1 + 1 .
Prove that 2mk + 1 and 2nk + 1 are relatively prime for
all but finitely many positive integers k.
A2 Find the largest real number a and the smallest real
number b such that
ax(π − x) ≤ sin x ≤ bx(π − x)
for all x in the interval [0, π].
A3 Alice and Bob play a game with a string of n digits, each
of which is restricted to be 0, 1, or 2. Initially all the
digits are 0. A legal move is to add or subtract 1 from
one digit to create a new string that has not appeared
before. A player with no legal move loses, and the other
player wins. Alice goes first, and the players alternate
moves. For each n ≥ 1, determine which player has a
strategy that guarantees winning.
A4 Find the minimal value of k such that there exist k-by-k
real matrices A1, . . . , A2025 with the property that AiA j =
A jAi if and only if |i − j| ∈ {0, 1, 2024}.
A5 Let n be an integer with n ≥ 2. For a sequence s =
(s1, . . . , sn−1) where each si = ±1, let f (s) be the num-
ber of permutations (a1, . . . , an) of {1, 2, . . . , n} such
that si(ai+1 − ai) > 0 for all i. For each n, determine
the sequences s for which f (s) is maximal.
A6 Let b0 = 0 and, for n ≥ 0, define bn+1 = 2b2
n + bn + 1.
For each k ≥ 1, show that b2k+1 − 2b2k is divisible by
22k+2 but not by 22k+3.
B1 Suppose that each point in the plane is colored either red
or green, subject to the following condition: For every
three noncollinear points A, B,C of the same color, the
center of the circle passing through A, B and C is also
this color. Prove that all points of the plane are the same
color.
B2 Let f : [0, 1] → [0, ∞) be strictly increasing and continu-
ous. Let R be the region bounded by x = 0, x = 1, y = 0,
and y = f (x). Let x1 be the x-coordinate of the centroid
of R. Le...', true, 'https://kskedlaya.org/putnam-archive/2025.pdf', 'English', 'USA', 'past_paper', 'Putnam', 'reference-papers/Putnam_2025.pdf');
INSERT INTO public.reference_questions (source_competition, year, subject, question_text, has_diagram, source_url, language, source_country, resource_type, learning_track, full_pdf_storage_path)
            VALUES ('Putnam', 2025, 'Mathematics', 'Solutions to the 86th William Lowell Putnam Mathematical Competition
Saturday, December 6, 2025
Manjul Bhargava, Kiran Kedlaya, and Lenny Ng
A1 For each k ≥ 0, the numbers 2mk + 1 and 2nk + 1 are
odd and hence their greatest common factor dk must be
odd. For an integer r, let Odd(r) denote the largest odd
factor of r. Then note that
Odd(mk+1 − nk+1) = Odd
 2mk + 1
dk
− 2nk + 1
dk

= Odd
 mk − nk
dk

≤ Odd(mk − nk),
with equality if and only if dk = 1. Thus Odd(mk −
nk) is a nonincreasing sequence of positive integers,
decreasing only when dk > 1. Hence the sequence
Odd(mk − nk) must stabilize once k is greater than some
K, implying that dk = 1 for k > K; that is, 2mk + 1 and
2nk + 1 are relatively prime for all k > K, as desired.
A2 The answer is a = 1/π and b = 4/π2.
First solution. It suffices to restrict to x ∈ [0, π/2]
rather than x ∈ [0, π] since the given inequalities are un-
changed if we replace x by π − x. Define the function
f (x) = sin x
x(π − x) ,
and note that f is differentiable on (0, π/2] and can be
extended continuously to x = 0 by setting f (0) = 1/π.
In particular, if a and b satisfy the desired condition,
then a ≤ 1/π and and b ≥ f (π/2) = 4/π2; it thus suf-
fices to check that a = 1/π and b = 4/π2 satisfy the
condition.
We compute that f ′(x) = g(x)
x2(π−x)2 for
g(x) = x(π − x) cos x − (π − 2x) sin x.
We claim that g(x) > 0 for all x ∈ (0, π/2). Indeed, note
that g(0) = g(π/2) = 0 and
g′(x) = (x2 − πx + 2)(sin x).
Noting that the quadratic x2 − πx + 2 is positive at x = 0
and negative at x = π/2, we see that it has a root
r ∈ (0, π/2), is positive before that root, and is nega-
tive after that root. That is, g′(x) > 0 for x ∈ (0, r) and
g′(x) < 0 for x ∈ (r, π/2). If some x0 ∈ (0, π/2) satis-
fied g(x0) ≤ 0, then we would have both x0 > r since g
is increasing in (0, r) and g(0) = 0, and x0 < r since g
is decreasing in (r, π/2) and g(π/2) = 0, contradiction.
This proves the claim.
Since f ′(x) > 0 on (0, π/2), it follows that f (x) is
strict...', true, 'https://kskedlaya.org/putnam-archive/2025s.pdf', 'English', 'USA', 'past_paper', 'Putnam', 'reference-papers/Putnam_2025.pdf');
INSERT INTO public.reference_questions (source_competition, year, subject, question_text, has_diagram, source_url, language, source_country, resource_type, learning_track, full_pdf_storage_path)
            VALUES ('Putnam', 2025, 'Mathematics', 'A NNOUNCEMENT OF WINNERS
of the eighty-sixth competition held on December 6, 2025
In each of the following categories, the listing is in alphabetical order.
THE PUTNAM FELLOWS — THE FIVE HIGHEST-RANKING PARTICIPANTS
Each receives an award of $2,500.
Jack Hu
Cheng Jiang
Luke Robitaille
Chunji Wang
Zixiang (Peter) Zhou
University of Chicago
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
THE NEXT TWELVE HIGHEST-RANKING PARTICIPANTS
Each receives an award of $1,000.
Claudio Bastiani-Fonck
Papon Lapate
Gyudong Lee
Derek Liu
Maximus Lu
Krishna Pothapragada
Pitchayut Saengrungkongka
Qiao Sun
Allen Wang
Hedong Wang
Kevin Wang
Xiaohan Zhang
University of Chicago
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Georgetown University
Massachusetts Institute of Technology
University of California, Santa Barbara

-- 1 of 24 --

THE NEXT EIGHT HIGHEST-RANKING PARTICIPANTS
Each receives an award of $250.
Warren Bei
Reagan Choi
Pico Gilman
Henry Jiang
Zhicheng Jiang
Shihan Kanungo
Jessica Wan
Yichen Xiao
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
Massachusetts Institute of Technology
San Jose State University
Massachusetts Institute of Technology
Massachusetts Institute of Technology

-- 2 of 24 --

HONORABLE MENTION — PARTICIPANTS
RANKED 26-100
This section does not include two participants who declined to be listed publicly.
David Anghel, MIT
Srinivas Arun, MIT
Advaith Avadhanam, MIT
Asha Basu, McGill University
Okezue Bell, Stanford University
Rohan Bodke, MIT
Ruben Carpenter, Yale University
Andrew Carratu, MIT
Perryn...', true, 'https://kskedlaya.org/putnam-archive/AnnouncementOfWinners2025.pdf', 'English', 'USA', 'past_paper', 'Putnam', 'reference-papers/Putnam_2025.pdf');
INSERT INTO public.reference_questions (source_competition, year, subject, question_text, has_diagram, source_url, language, source_country, resource_type, learning_track, full_pdf_storage_path)
            VALUES ('Putnam', 2024, 'Mathematics', 'The 85th William Lowell Putnam Mathematical Competition
Saturday, December 7, 2024
A1 Determine all positive integers n for which there exist
positive integers a, b, and c satisfying
2an + 3bn = 4cn.
A2 For which real polynomials p is there a real polynomial
q such that
p(p(x)) − x = (p(x) − x)2q(x)
for all real x?
A3 Let S be the set of bijections
T : {1, 2, 3} × {1, 2, . . . , 2024} → {1, 2, . . . , 6072}
such that T (1, j) < T (2, j) < T (3, j) for all j ∈
{1, 2, . . . , 2024} and T (i, j) < T (i, j + 1) for all i ∈
{1, 2, 3} and j ∈ {1, 2, . . . , 2023}. Do there exist a and c
in {1, 2, 3} and b and d in {1, 2, . . . , 2024} such that the
fraction of elements T in S for which T (a, b) < T (c, d)
is at least 1/3 and at most 2/3?
A4 Find all primes p > 5 for which there exists an integer
a and an integer r satisfying 1 ≤ r ≤ p − 1 with the fol-
lowing property: the sequence 1, a, a2, . . . , ap−5 can be
rearranged to form a sequence b0, b1, b2, . . . , bp−5 such
that bn − bn−1 − r is divisible by p for 1 ≤ n ≤ p − 5.
A5 Consider a circle Ω with radius 9 and center at the ori-
gin (0, 0), and a disc ∆ with radius 1 and center at (r, 0),
where 0 ≤ r ≤ 8. Two points P and Q are chosen in-
dependently and uniformly at random on Ω. Which
value(s) of r minimize the probability that the chord PQ
intersects ∆?
A6 Let c0, c1, c2, . . . be the sequence defined so that
1 − 3x − √1 − 14x + 9x2
4 =
∞
∑
k=0
ckxk
for sufficiently small x. For a positive integer n, let A
be the n-by-n matrix with i, j-entry ci+ j−1 for i and j in
{1, . . . , n}. Find the determinant of A.
B1 Let n and k be positive integers. The square in the ith
row and jth column of an n-by-n grid contains the num-
ber i + j − k. For which n and k is it possible to select
n squares from the grid, no two in the same row or col-
umn, such that the numbers contained in the selected
squares are exactly 1, 2, . . . , n?
B2 Two convex quadrilaterals are called partners if they
have three vertices in common and they c...', true, 'https://kskedlaya.org/putnam-archive/2024.pdf', 'English', 'USA', 'past_paper', 'Putnam', 'reference-papers/Putnam_2024.pdf');
INSERT INTO public.reference_questions (source_competition, year, subject, question_text, has_diagram, source_url, language, source_country, resource_type, learning_track, full_pdf_storage_path)
            VALUES ('Putnam', 2024, 'Mathematics', 'Solutions to the 85th William Lowell Putnam Mathematical Competition
Saturday, December 7, 2024
Manjul Bhargava, Kiran Kedlaya, and Lenny Ng
A1 The answer is n = 1. When n = 1, (a, b, c) = (1, 2, 2) is
a solution to the given equation. We claim that there are
no solutions when n ≥ 2.
For n = 2, suppose that we have a solution to 2a2 +
3b2 = 4c2 with a, b, c ∈ N. By dividing each of a, b, c
by gcd(a, b, c), we obtain another solution; thus we
can assume that gcd(a, b, c) = 1. Note that we have
a2 + c2 ≡ 0 (mod 3), and that only 0 and 1 are per-
fect squares mod 3; thus we must have a2 ≡ c2 ≡ 0
(mod 3). But then a, c are both multiples of 3; it follows
from b2 = 12(c/3)2 −6(a/3)2 that b is a multiple of 3 as
well, contradicting our assumption that gcd(a, b, c) = 1.
For n ≥ 3, suppose that 2an + 3bn = 4cn. As in the
previous case, we can assume gcd(a, b, c) = 1. Since
3bn = 4cn − 2an, b must be even. We can then write
an + 2n−1 · 3(b/2)n = 2cn, and so a must be even.
Then 2n−1(a/2)n + 2n−2 · 3(b/2)n = cn, and c must be
even as well. This contradicts our assumption that
gcd(a, b, c) = 1.
A2 The answer is p(x) = ±x + c for any c ∈ R. Note that
any such polynomial works: if p(x) = x + c then p(x) −
x = c, while if p(x) = −x + c then p(p(x)) − x = 0. We
will show that in fact these are the only polynomials
p(x) such that p(p(x)) − x is divisible by r(x)2, where
r(x) = p(x) − x.
First solution. Suppose that p(p(x)) − x is divisible by
r(x)2. Then
x ≡ p(p(x))
= p(x + r(x))
≡ p(x) + p′(x)r(x) (mod r(x)2).
In other words, r(x)(1 + p′(x)) is divisible by r(x)2.
From this, it follows that either r(x) = 0 or 1 + p′(x)
is divisible by r(x). In the first case, we have p(x) = x.
In the second case, if 1 + p′(x) = 0 then p(x) = −x + c
for some constant c; otherwise, we have
deg(p) − 1 = deg(1 + p′(x)) ≥ deg(r)
and this is only possible if p(x) = x + c for some con-
stant c.
Second solution. Suppose that p(p(x)) − x is divisible
by r(x)2. Then
0 ≡ d
dx (p(p(x)) − x)
= p′(x)p′(p(x)) − ...', true, 'https://kskedlaya.org/putnam-archive/2024s.pdf', 'English', 'USA', 'past_paper', 'Putnam', 'reference-papers/Putnam_2024.pdf');
