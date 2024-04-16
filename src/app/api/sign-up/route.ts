import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import bcrypt from 'bcryptjs'
import { sendVerificationEmail } from "@/helpers/sendVerificationEmail";

export async function POST(request: Request) {
    await dbConnect(); 
    try {
        const {username, email, password} = await request.json();

        const existingUserVerifiedByUsername = await UserModel.findOne({
            username,
            isVerified: true
        });

        if(existingUserVerifiedByUsername) {
            return Response.json({
                success: false,
                message: "Username is already taken"
            }, { status: 400 });
        }

        const exisitingUserByEmail = await UserModel.findOne({email});
        let verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

        if(exisitingUserByEmail) {
            if(exisitingUserByEmail.isVerified) {
                return Response.json(
                    {
                        success: false,
                        message: "User already exists with this email address."
                    },
                    { status: 400}
                )
            } else {
                const hashedPassword = await bcrypt.hash(password, 10);
                exisitingUserByEmail.password = hashedPassword;
                exisitingUserByEmail.verifyCode = verifyCode;
                exisitingUserByEmail.verifyCodeExpiry = new Date(Date.now() + 3600000);
                await exisitingUserByEmail.save();
            }
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + 1);
            const newUser = new UserModel({
                username,
                email,
                password: hashedPassword,
                verifyCode,
                verifyCodeExpiry: expiryDate,
                isVerified: false,
                isAcceptingMessages: true,
                messages: [],
              });

              await newUser.save();
        }

        // send verification email
        const emailResponse = await sendVerificationEmail(email, username, verifyCode);

        if(!emailResponse.success) {
            return Response.json({
                success: false,
                message: emailResponse.message,
            },
            { status: 400 }
        )
        };

        return Response.json(
            {
                success: true,
                message: "User has been registered successfully. Please verify your account."
            },
            {
                status: 201
            }
        )


    } catch (error) {
        console.error('Error registering user', error);
        return Response.json(
            {
                success: false,
                message: "Error registering user"
            },
            {
                status: 500
            }
        )
    }
}