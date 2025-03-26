import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import { PrismaClient } from "@prisma/client";
import { FINAL_MAIL_VERIFICATION, sendOtp } from "../utils/otp_mail_verification";
import { JWT_USER_SECRET } from "../config";
import { signinValidationSchema, signupValidationSchema } from "../utils/zodSchema";
import { resetPassword, sendOtp_forgotPassword } from "../utils/otp_forgot_password";

const prisma = new PrismaClient();


export const signup = async (req: Request, res: Response) => {
    try {

        const result = signupValidationSchema.safeParse(req.body);

        // If validation fails, return an error
        if (!result.success) {
            res.status(400).json({
                message: 'Validation error',
                errors: result.error.flatten().fieldErrors,
            });
            return;
        }

        const { username, email, contactNumber, password } = result.data;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (existingUser) {
            res.status(400).json({
                message: "User already exists in SWS Database!!"
            });
            return;
        }

        // Uptill here input validation is done!

        // HASHING THE PASSWORD:

        const hashedPassword = await bcrypt.hash(password, 10);
        const otpGenerated = Math.floor(100000 + Math.random() * 900000).toString();
        // STORING the user to Database!

        const USER = await prisma.user.create({
            data: {
                username: username,
                email: email,
                contactNumber: contactNumber,
                password: hashedPassword,
                otpForVerification: otpGenerated // THE GENERATED OTP IS STORED IMMEDIATELY IN THE DATABASE!!
            }
        });

        // Otp SENT To the User for Verification
        await sendOtp(email, otpGenerated);

        res.status(201).json({
            message: `OTP Sent to ${USER.email} for verification!`,
        })

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Something Went Wrong, Please Try Again Later"
        });
    }
};

export const verify_email = async (req: Request, res: Response) => {
    const { email, otpEntered } = req.body;
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (user?.email === email) {
        FINAL_MAIL_VERIFICATION(otpEntered, email, res)
    }
    else {
        res.status(400).json({
            message: "Enter the correct email address, the email which you entered while SignUp!"
        });
        return;
    }
}

export const signin = async (req: Request, res: Response) => {
    try {
        const result = signinValidationSchema.safeParse(req.body);

        // If validation fails, return an error
        if (!result.success) {
            res.status(400).json({
                message: "Validation error",
                errors: result.error.flatten().fieldErrors,
            });
            return;
        }

        const { email, password } = result.data;

        // Find the user in the database
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            res.status(400).json({
                message: "User Not Found"
            });
            return;
        }

        if (user.isMailVerified === false) {
            res.status(400).json({
                message: "Cannot Login!, Please Verify Your Email First!"
            })
            return;
        }

        // Compare password with hashed password in DB
        const matchPassword = await bcrypt.compare(password, user.password);
        if (!matchPassword) {
            res.status(401).json({
                message: "Incorrect Password!"
            });
            return;
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            JWT_USER_SECRET,
            {
                expiresIn: "4d" // Token expires in 4 day
            }
        );

        // Set the JWT token as an HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true, // Prevents JavaScript access (more secure)
            secure: process.env.NODE_ENV === "production", // Use secure cookies in production
            sameSite: "strict", // Prevent CSRF attacks
            maxAge: 4 * 24 * 60 * 60 * 1000, // 4 days
        });

        res.status(200).json({
            message: "User Logged In Successfully!",
            user: {
                id: user.id,
                email: user.email
            },
        });

    } catch (error) {
        console.error("Signin Error:", error);
        res.status(500).json({
            message: "Something Went Wrong, Please Try Again Later"
        });
    }
};

export const logout = (req:Request, res:Response) => {
    res.clearCookie("token");
    res.status(200).json({
        message: "User Logged Out Successfully!"
    })
}

export const filter = async (req: Request, res: Response) => {
    await prisma.user.deleteMany({
        where: {
            isMailVerified: false
        }
    })

    const data = await prisma.user.findMany();

    res.status(200).json({
        message: "Deleted all the unverified users!!",
        data
    })
}

export const getAllUsers = async (req: Request, res: Response) => {
    const USERS = await prisma.user.findMany();
    // let finalUserArray: UserResponse[] = [];

    let finalUserArray: {
        id: String;
        role: String;
        username: string;
        email: string;
        contactNumber: string;
        isMailVerified: boolean;
        userAddedAt: Date;
    }[] = [];


    USERS.forEach(user => {
        finalUserArray.push({
            id: user.id,
            role: user.role,
            username: user.username,
            email: user.email,
            contactNumber: user.contactNumber,
            isMailVerified: user.isMailVerified,
            userAddedAt: user.UserAddedAt
        })
    })
    res.json({
        finalUserArray
    })
}

export const me = async (req: Request, res: Response) => {
    try {
        if (!(req as any).user) {
            res.status(401).json({
                message: "ACCESS DENIED"
            })
        }

        const userId = (req as any).user.id;

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        })

        if (!user) {
            res.status(400).json({
                message: "Sorry User Not Found!"
            })
        }

        const finalUserData = {
            role: user?.role,
            username: user?.username,
            email: user?.email,
            contactNumber: user?.contactNumber,
            isMailVerified: user?.isMailVerified,
            userAddedAt: user?.UserAddedAt
        }

        res.status(200).json({
            finalUserData
        })

    } catch (error) {
        res.status(500).json({
            message: 'Something Went Wrong, Please Try Again Later',
            error
        });
    }
}

export const forgotPassword = async (req: Request, res: Response) => {

    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                email
            }
        })

        if (!user) {
            res.status(400).json({
                message: `User with email ${email} not found in Our Database!, Enter the correct email address, the email which you entered while SignUp!`
            })
            return
        }

        const otpGenerated = Math.floor(100000 + Math.random() * 900000).toString();

        await sendOtp_forgotPassword(email, otpGenerated);

        await prisma.user.update({
            where: {
                email: email
            },
            data: {
                otpForResetPassword: otpGenerated
            }
        })

        res.json({
            message: `OTP Sent to ${user.email} For Password Reset!`,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Something Went Wrong, Please Try Again Later"
        });
    }
}

export const passwordReset = async (req: Request, res: Response) => {
    const { email, otpEntered, newPassword } = req.body;
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (user?.email === email) {
        resetPassword(otpEntered , user?.email as string , newPassword , res);
    }
    else {
        res.status(400).json({
            message: "Enter the correct email address, the email which you entered while SignUp!"
        });
        return;
    }
}